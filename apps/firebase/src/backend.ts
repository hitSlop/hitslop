import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  RegistryTemplateSchema, RegistryReleaseDocumentSchema, RegistryPublisherSchema,
  RegistryPublishRequestSchema, CatalogTemplateSchema, validate,
  type RegistryAsset, type RegistryPublishResult, type CatalogTemplate, type SlopManifest,
} from "@hitslop/schema";
import { readRegistryDocument, writeRegistryDocument } from "./registry-codec.js";

type StorageFile = {
  exists(): Promise<[boolean]>;
  save(data: Buffer, options: { resumable: boolean; metadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
};

type StorageBucket = {
  name: string;
  file(key: string): StorageFile;
};

export type PublishResult = RegistryPublishResult;
type RegistryCatalogAsset = RegistryAsset;
export type RegistryCatalogTemplate = Omit<CatalogTemplate, "preview" | "icon" | "download"> & {
  preview: RegistryCatalogAsset;
  icon: RegistryCatalogAsset;
  download: RegistryCatalogAsset;
};

export type FinalizePublishInput = {
  requestId: string;
  publisherKeyId: string;
  publicKey: string;
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
  listTemplates(): Promise<RegistryCatalogTemplate[]>;
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
        const data = readRegistryDocument(RegistryPublishRequestSchema, previous.data());
        if (data.publisherKeyId !== input.publisherKeyId || data.artifactSha256 !== input.artifactSha256) {
          throw new Error("Publish request id was reused with different content");
        }
        return data.result;
      }

      const [publisher, template] = await Promise.all([
        transaction.get(publisherRef),
        transaction.get(templateRef),
      ]);
      const existingPublisher = publisher.exists ? readRegistryDocument(RegistryPublisherSchema, publisher.data()) : undefined;
      const existingTemplate = template.exists ? readRegistryDocument(RegistryTemplateSchema, template.data()) : undefined;
      if (existingPublisher && existingPublisher.publicKey !== input.publicKey) {
        throw new Error("Publisher key does not match its key id");
      }

      const now = new Date().toISOString();
      const releaseNumber = (existingTemplate?.currentRelease.number ?? 0) + 1;
      const publisherCreatedAt = existingPublisher?.createdAt ?? now;
      const firstPublishedAt = existingTemplate?.firstPublishedAt ?? now;
      const creationCount = existingTemplate?.creationCount ?? 0;
      const visibility = existingTemplate?.visibility ?? "public";
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

      transaction.set(publisherRef, writeRegistryDocument(RegistryPublisherSchema, {
        keyId: input.publisherKeyId,
        publicKey: input.publicKey,
        createdAt: publisherCreatedAt,
        updatedAt: now,
      }));
      transaction.set(releaseRef, writeRegistryDocument(RegistryReleaseDocumentSchema, {
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
      }));
      transaction.set(templateRef, writeRegistryDocument(RegistryTemplateSchema, {
        id: templateId,
        publisherKeyId: input.publisherKeyId,
        authorName: input.manifest.author.name,
        ...(input.manifest.author.url ? { authorURL: input.manifest.author.url } : {}),
        slug: input.manifest.slug,
        title: input.manifest.title,
        description: input.manifest.description,
        categories: input.manifest.categories,
        currentRelease,
        creationCount,
        firstPublishedAt,
        visibility,
      }));
      transaction.set(requestRef, writeRegistryDocument(RegistryPublishRequestSchema, {
        requestId: input.requestId,
        publisherKeyId: input.publisherKeyId,
        artifactSha256: input.artifactSha256,
        result: { templateId, releaseId: releaseRef.id, releaseNumber },
        createdAt: now,
        expiresAt: new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1_000).toISOString(),
      }));
      return { templateId, releaseId: releaseRef.id, releaseNumber };
    });
  }

  async listTemplates(): Promise<RegistryCatalogTemplate[]> {
    const snapshot = await this.firestore.collection("templates")
      .where("visibility", "==", "public")
      .orderBy("creationCount", "desc")
      .orderBy("firstPublishedAt", "desc")
      .limit(200)
      .get();
    const templates: RegistryCatalogTemplate[] = [];
    for (const document of snapshot.docs) {
      try {
        const data = readRegistryDocument(RegistryTemplateSchema, document.data());
        if (data.id !== document.id) throw new Error("Registry template id does not match document id");
        const release = data.currentRelease;
        const author = data.authorURL ? { name: data.authorName, url: data.authorURL } : { name: data.authorName };
        const metadata = {
          id: document.id,
          slug: data.slug,
          title: data.title,
          description: data.description,
          categories: data.categories,
          author,
          creationCount: data.creationCount,
          release: { number: release.number, publishedAt: release.publishedAt },
        };
        // Validate the public projection independently of the retained manifest string.
        const publicAsset = (asset: RegistryAsset) => ({ url: this.mediaURL(asset.key), sha256: asset.sha256, bytes: asset.bytes });
        const projection = validate(CatalogTemplateSchema, {
          ...metadata, preview: publicAsset(release.preview), icon: publicAsset(release.icon), download: publicAsset(release.artifact),
        });
        templates.push({ ...projection, preview: release.preview, icon: release.icon, download: release.artifact });
      } catch (error) {
        console.error(`Skipping invalid public template ${document.id}`, error);
      }
    }
    return templates;
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
