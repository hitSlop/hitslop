import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { SlopManifest } from "@hitslop/schema";

type StorageFile = {
  exists(): Promise<[boolean]>;
  save(data: Buffer, options: { resumable: boolean; metadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
};

type StorageBucket = {
  name: string;
  file(key: string): StorageFile;
};

export type PublishResult = { templateId: string; releaseId: string; releaseNumber: number };

export type FinalizePublishInput = {
  requestId: string;
  publisherKeyId: string;
  publicKey: string;
  displayName: string;
  artifactKey: string;
  artifactSha256: string;
  artifactBytes: number;
  previewKey: string;
  previewSha256: string;
  previewBytes: number;
  iconKey: string;
  iconSha256: string;
  iconBytes: number;
  manifest: SlopManifest;
};

export interface RegistryBackend {
  objectExists(key: string): Promise<boolean>;
  putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  mediaURL(key: string): string;
  finalizePublish(input: FinalizePublishInput): Promise<PublishResult>;
  recordCreation(templateId: string): Promise<boolean>;
}

export class FirebaseRegistryBackend implements RegistryBackend {
  constructor(private readonly firestore: Firestore, private readonly bucket: StorageBucket) {}

  async objectExists(key: string): Promise<boolean> {
    const [exists] = await this.bucket.file(key).exists();
    return exists;
  }

  async putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const file = this.bucket.file(key);
    const [exists] = await file.exists();
    if (exists) return;
    await file.save(Buffer.from(bytes), {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  }

  mediaURL(key: string): string {
    const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const origin = emulatorHost ? `http://${emulatorHost}` : "https://firebasestorage.googleapis.com";
    return `${origin}/v0/b/${encodeURIComponent(this.bucket.name)}/o/${encodeURIComponent(key)}?alt=media`;
  }

  async finalizePublish(input: FinalizePublishInput): Promise<PublishResult> {
    const publisherRef = this.firestore.collection("publishers").doc(input.publisherKeyId);
    const templateId = `${input.publisherKeyId}_${input.manifest.slug}`;
    const templateRef = this.firestore.collection("templates").doc(templateId);
    const releaseRef = this.firestore.collection("releases").doc();
    const requestRef = this.firestore.collection("publishRequests").doc(`${input.publisherKeyId}_${input.requestId}`);

    return this.firestore.runTransaction(async (transaction) => {
      const previous = await transaction.get(requestRef);
      if (previous.exists) {
        const data = previous.data()!;
        if (data.publisherKeyId !== input.publisherKeyId || data.artifactSha256 !== input.artifactSha256) {
          throw new Error("Publish request id was reused with different content");
        }
        return {
          templateId: String(data.result.templateId),
          releaseId: String(data.result.releaseId),
          releaseNumber: Number(data.result.releaseNumber),
        };
      }

      const [publisher, template] = await Promise.all([
        transaction.get(publisherRef),
        transaction.get(templateRef),
      ]);
      if (publisher.exists && publisher.get("publicKey") !== input.publicKey) {
        throw new Error("Publisher key does not match its key id");
      }

      const now = Timestamp.now();
      const releaseNumber = template.exists ? Number(template.get("currentRelease.number") ?? 0) + 1 : 1;
      const publisherCreatedAt = publisher.exists ? publisher.get("createdAt") ?? now : now;
      const firstPublishedAt = template.exists ? template.get("firstPublishedAt") ?? now : now;
      const creationCount = template.exists ? Number(template.get("creationCount") ?? 0) : 0;
      const visibility = template.exists ? String(template.get("visibility") ?? "public") : "public";
      const manifestJSON = JSON.stringify(input.manifest);
      const artifact = { key: input.artifactKey, sha256: input.artifactSha256, bytes: input.artifactBytes };
      const preview = { key: input.previewKey, sha256: input.previewSha256, bytes: input.previewBytes };
      const icon = { key: input.iconKey, sha256: input.iconSha256, bytes: input.iconBytes };
      const currentRelease = {
        id: releaseRef.id,
        number: releaseNumber,
        publishedAt: now,
        artifact,
        preview,
        icon,
        manifestJSON,
      };

      transaction.set(publisherRef, {
        keyId: input.publisherKeyId,
        publicKey: input.publicKey,
        displayName: input.displayName,
        createdAt: publisherCreatedAt,
        updatedAt: now,
      });
      transaction.set(releaseRef, {
        id: releaseRef.id,
        templateId,
        publisherKeyId: input.publisherKeyId,
        slug: input.manifest.slug,
        number: releaseNumber,
        artifact,
        preview,
        icon,
        manifestJSON,
        publishedAt: now,
      });
      transaction.set(templateRef, {
        id: templateId,
        publisherKeyId: input.publisherKeyId,
        publisherDisplayName: input.displayName,
        slug: input.manifest.slug,
        title: input.manifest.title,
        description: input.manifest.description,
        categories: input.manifest.categories,
        searchText: [input.manifest.title, input.manifest.description, ...input.manifest.categories].join(" ").toLocaleLowerCase(),
        currentRelease,
        creationCount,
        firstPublishedAt,
        visibility,
      });
      transaction.set(requestRef, {
        requestId: input.requestId,
        publisherKeyId: input.publisherKeyId,
        artifactSha256: input.artifactSha256,
        result: { templateId, releaseId: releaseRef.id, releaseNumber },
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1_000),
      });
      return { templateId, releaseId: releaseRef.id, releaseNumber };
    });
  }

  async recordCreation(templateId: string): Promise<boolean> {
    const templateRef = this.firestore.collection("templates").doc(templateId);
    return this.firestore.runTransaction(async (transaction) => {
      const template = await transaction.get(templateRef);
      if (!template.exists || template.get("visibility") !== "public") return false;
      transaction.update(templateRef, { creationCount: FieldValue.increment(1) });
      return true;
    });
  }
}
