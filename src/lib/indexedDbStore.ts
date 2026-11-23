import type { AuditEntry, Measurement, SyncEnvelope } from "../domain/types";

const DB_NAME = "astronaut-health-offline";
const DB_VERSION = 1;

export interface AppendOnlyStore {
  appendMeasurement(record: Measurement): Promise<void>;
  appendAudit(entry: AuditEntry): Promise<void>;
  enqueueEnvelope(envelope: SyncEnvelope): Promise<void>;
  listPendingSync(limit?: number): Promise<SyncEnvelope[]>;
  markSyncState(
    eventId: string,
    state: SyncEnvelope["syncState"],
  ): Promise<void>;
  listMeasurements(crewMemberId?: string): Promise<Measurement[]>;
  close(): void;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("measurements")) {
        const measurements = db.createObjectStore("measurements", {
          keyPath: "id",
        });
        measurements.createIndex("eventId", "eventId", { unique: true });
        measurements.createIndex("crewMemberId", "crewMemberId");
      }

      if (!db.objectStoreNames.contains("audit")) {
        const audit = db.createObjectStore("audit", { keyPath: "id" });
        audit.createIndex("eventId", "eventId", { unique: true });
        audit.createIndex("occurredAt", "occurredAt");
      }

      if (!db.objectStoreNames.contains("outbox")) {
        const outbox = db.createObjectStore("outbox", {
          keyPath: "eventId",
        });
        outbox.createIndex("syncState", "syncState");
        outbox.createIndex("priority", "priority");
        outbox.createIndex("idempotencyKey", "idempotencyKey", {
          unique: true,
        });
      }

      if (!db.objectStoreNames.contains("outboxTransitions")) {
        const transitions = db.createObjectStore("outboxTransitions", {
          keyPath: "id",
        });
        transitions.createIndex("eventId", "eventId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function request<T>(transaction: IDBTransaction, operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(operation.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function createIndexedDbStore(): Promise<AppendOnlyStore> {
  const db = await openDatabase();

  return {
    appendMeasurement(record) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction("measurements", "readwrite");
        tx.objectStore("measurements").add(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    appendAudit(entry) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction("audit", "readwrite");
        tx.objectStore("audit").add(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    enqueueEnvelope(envelope) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction("outbox", "readwrite");
        tx.objectStore("outbox").add(envelope);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    async listPendingSync(limit = 100) {
      const tx = db.transaction(
        ["outbox", "outboxTransitions"],
        "readonly",
      );
      const envelopeStore = tx.objectStore("outbox");
      const transitionStore = tx.objectStore("outboxTransitions");
      const [result, transitions] = await Promise.all([
        request<SyncEnvelope[]>(tx, envelopeStore.getAll()),
        request<
          Array<{
            eventId: string;
            state: SyncEnvelope["syncState"];
            transitionedAt: string;
          }>
        >(tx, transitionStore.getAll()),
      ]);
      const latestTransition = new Map<
        string,
        { state: SyncEnvelope["syncState"]; transitionedAt: string }
      >();
      transitions.forEach((transition) => {
        const existing = latestTransition.get(transition.eventId);
        if (
          !existing ||
          transition.transitionedAt.localeCompare(existing.transitionedAt) > 0
        ) {
          latestTransition.set(transition.eventId, transition);
        }
      });
      const priorityOrder = { critical: 0, high: 1, routine: 2 };
      return result
        .filter(
          (item) =>
            (latestTransition.get(item.eventId)?.state ??
              item.syncState) === "pending",
        )
        .sort(
          (a, b) =>
            priorityOrder[a.priority] - priorityOrder[b.priority] ||
            a.deviceSequence - b.deviceSequence,
        )
        .slice(0, limit);
    },
    async markSyncState(eventId, state) {
      const tx = db.transaction(["outbox", "outboxTransitions"], "readwrite");
      const envelopeStore = tx.objectStore("outbox");
      const transitionStore = tx.objectStore("outboxTransitions");
      await new Promise<SyncEnvelope | undefined>((resolve, reject) => {
        const getRequest = envelopeStore.get(eventId);
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      }).then((current) => {
        if (!current) throw new Error(`Unknown outbox event: ${eventId}`);
      });
      await new Promise<void>((resolve, reject) => {
        const transition = {
          id: crypto.randomUUID(),
          eventId,
          state,
          transitionedAt: new Date().toISOString(),
        };
        const addRequest = transitionStore.add(transition);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    },
    async listMeasurements(crewMemberId) {
      const tx = db.transaction("measurements", "readonly");
      const store = tx.objectStore("measurements");
      if (!crewMemberId) {
        return request<Measurement[]>(tx, store.getAll());
      }
      const index = store.index("crewMemberId");
      return request<Measurement[]>(tx, index.getAll(crewMemberId));
    },
    close() {
      db.close();
    },
  };
}
