import {
  serviceContextFromDefaults,
  SimpleDirectoryReader,
  storageContextFromDefaults,
  VectorStoreIndex,
  QdrantVectorStore
} from "llamaindex";

import * as dotenv from "dotenv";

import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  STORAGE_CACHE_DIR,
  STORAGE_DIR,
  QDRANT_FILES_DIR
} from "./constants.mjs";

dotenv.config();

async function getRuntime(func) {
  const start = Date.now();
  await func();
  const end = Date.now();
  return end - start;
}

async function generateDatasource(serviceContext) {
  console.log(`Generating storage context...`);
  const ms = await getRuntime(async () => {

    const vectorStore = new QdrantVectorStore({
      url: "http://localhost:6333",
    });

    const documents = await new SimpleDirectoryReader().loadData({
      directoryPath: QDRANT_FILES_DIR,
    });

    const index = await VectorStoreIndex.fromDocuments(documents, {
      vectorStore,
    });

    const storageContext = await storageContextFromDefaults({
      persistDir: STORAGE_CACHE_DIR,
    });

    await VectorStoreIndex.fromDocuments(documents, {
      storageContext,
      serviceContext,
    });
  });
  console.log(`Storage context successfully generated in ${ms / 1000}s.`);
}

(async () => {
  const serviceContext = serviceContextFromDefaults({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  await generateDatasource(serviceContext);
  console.log("Finished generating storage.");
})();
