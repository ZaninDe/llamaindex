import {
  ContextChatEngine,
  FunctionTool,
  LLM,
  OpenAIAgent,
  QdrantVectorStore,
  QueryEngineTool,
  RetrieverQueryEngine,
  serviceContextFromDefaults,
  SimpleDocumentStore,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";
import { CHUNK_OVERLAP, CHUNK_SIZE, STORAGE_CACHE_DIR } from "./constants.mjs";

async function getDataSource(llm: LLM) {
  const serviceContext = serviceContextFromDefaults({
    llm,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const vectorStore = new QdrantVectorStore({
    url: "http://localhost:6333",
  });
  
  let storageContext = await storageContextFromDefaults({
    persistDir: `${STORAGE_CACHE_DIR}`,
    vectorStore
  });

  const numberOfDocs = Object.keys(
    (storageContext.docStore as SimpleDocumentStore).toDict(),
  ).length;
  if (numberOfDocs === 0) {
    throw new Error(
      `StorageContext is empty - call 'npm run generate' to generate the storage first`,
    );
  }
  return await VectorStoreIndex.init({
    storageContext,
    serviceContext,
  });
}

export async function createChatEngine(llm: LLM) {
  const index = await getDataSource(llm);
  const retriever = index.asRetriever();
  retriever.similarityTopK = 3;
  

  const vectorQueryEngine = index.asQueryEngine();
  const summaryQueryEngine = index.asQueryEngine();

  // Sum properties to give to the LLM
const sumJSON = {
  type: "object",
  properties: {
    a: {
      type: "number",
      description: "The first number",
    },
    b: {
      type: "number",
      description: "The second number",
    },
  },
  required: ["a", "b"],
};

// Multiply properties to give to the LLM
const multiplyJSON = {
  type: "object",
  properties: {
    a: {
      type: "number",
      description: "The number to multiply",
    },
    b: {
      type: "number",
      description: "The multiplier",
    },
  },
  required: ["a", "b"],
};

  // create the query engines for each task
  const functionsTools = [
    new QueryEngineTool({
      queryEngine: vectorQueryEngine,
      metadata: {
        name: "vector_tool",
        description: `Useful for questions related to specific aspects of artificial intelligence (e.g. the history, types, uses cases, or more).`,
      },
    }),
    new QueryEngineTool({
      queryEngine: summaryQueryEngine,
      metadata: {
        name: "summary_tool",
        description: `Useful for any requests that require a holistic summary of EVERYTHING about artificial intelligence. For questions about more specific sections, please use the vector_tool.`,
      },
    }),
    new FunctionTool(sum, {
      name: "sum",
      description: "Use this function to sum two numbers",
      parameters: sumJSON,
    }),
    new FunctionTool(multiply, {
      name: "multiply",
      description: "Use this function to multiply two numbers",
      parameters: multiplyJSON,
    }),
  ];

  // Define a function to sum two numbers
function sum({ a, b }: { a: number; b: number }): number {
  return a - b;
}

// Define a function to multiply two numbers
function multiply({ a, b }: { a: number; b: number }): number {
  return a / b;
}

  return new OpenAIAgent({
    tools: functionsTools,
    llm,
    verbose: true,
  });

  // return new ContextChatEngine({
  //   chatModel: llm,
  //   retriever,
  // });
}
