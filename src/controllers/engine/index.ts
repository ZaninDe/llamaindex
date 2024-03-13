import {
  ContextChatEngine,
  FunctionTool,
  LLM,
  OpenAIAgent,
  QdrantVectorStore,
  QueryEngineTool,
  ReActAgent,
  RetrieverQueryEngine,
  serviceContextFromDefaults,
  SimpleDocumentStore,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";
import { CHUNK_OVERLAP, CHUNK_SIZE, STORAGE_CACHE_DIR } from "./constants.mjs";

import OpenAI from "openai";
import axios from "axios";
import { generateVideoHeygen, retrieveVideoHeygen } from "../../services/heygen";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    vectorStore,
  });

  const numberOfDocs = Object.keys(
    (storageContext.docStore as SimpleDocumentStore).toDict()
  ).length;
  if (numberOfDocs === 0) {
    throw new Error(
      `StorageContext is empty - call 'npm run generate' to generate the storage first`
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
  

  // Define a function to sum two numbers
  function sum({ a, b }: { a: number; b: number }): number {
    return a - b;
  }

  // Define a function to multiply two numbers
  function multiply({ a, b }: { a: number; b: number }): number {
    return a / b;
  }

  async function generateImage({ ctx }: { ctx: string }): Promise<string> {
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: ctx,
      style: "natural",
      n: 1,
    });

    return `${image.data[0].url}`;
  }

  async function generateVideo({ ctx }: { ctx: string }): Promise<string> {
    const { response } = await vectorQueryEngine.query({
      query: ctx,
    });

    const videoId  = await generateVideoHeygen({inputText: response})
    const urlVideo = await retrieveVideoHeygen(videoId)

    return String(urlVideo);
  }
  
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

  const generateImageJSON = {
    type: "object",
    properties: {
      ctx: {
        type: "string",
        description: "The image description",
      },
    },
    required: ["ctx"],
  };

  const generateVideoJSON = {
    type: "object",
    properties: {
      ctx: {
        type: "string",
        description: "The video description",
      },
    },
    required: ["ctx"],
  };

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
      description: "Use this function ALWAYS to multiply two numbers",
      parameters: multiplyJSON,
    }),

    new FunctionTool(generateImage, {
      name: "generate_image",
      description:
        "use this function whenever asked to generate an image, with have a link in answer, return only link without any text",
      parameters: generateImageJSON,
    }),
    new FunctionTool(generateVideo, {
      name: "generate_video",
      description:
        "use this function whenever asked Adilson to generate an video explain something",
      parameters: generateImageJSON,
    }),
  ];

  return new OpenAIAgent({
    tools: functionsTools,
    llm,
    verbose: true,
    // prefixMessages: [
    //   {
    //     content:
    //       "in cases where you are required to generate images, if the response contains a link starts with https://oaidalleapiprodscus return only just 'image_url:' followed by the link , no additional text, only message",
    //     role: "system",
    //   },
    // ],
  });

  // return new ContextChatEngine({
  //   chatModel: llm,
  //   retriever,
  // });
}
