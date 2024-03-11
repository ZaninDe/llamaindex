var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// index.ts
import cors from "cors";
import "dotenv/config";
import express2 from "express";

// src/routes/chat.route.ts
import express from "express";

// src/controllers/chat.controller.ts
import { OpenAI } from "llamaindex";

// src/controllers/engine/index.ts
import {
  FunctionTool,
  OpenAIAgent,
  QdrantVectorStore,
  QueryEngineTool,
  serviceContextFromDefaults,
  storageContextFromDefaults,
  VectorStoreIndex
} from "llamaindex";

// src/controllers/engine/constants.mjs
var STORAGE_CACHE_DIR = "./cache";
var CHUNK_SIZE = 512;
var CHUNK_OVERLAP = 20;

// src/controllers/engine/index.ts
function getDataSource(llm) {
  return __async(this, null, function* () {
    const serviceContext = serviceContextFromDefaults({
      llm,
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP
    });
    const vectorStore = new QdrantVectorStore({
      url: "http://localhost:6333"
    });
    let storageContext = yield storageContextFromDefaults({
      persistDir: `${STORAGE_CACHE_DIR}`,
      vectorStore
    });
    const numberOfDocs = Object.keys(
      storageContext.docStore.toDict()
    ).length;
    if (numberOfDocs === 0) {
      throw new Error(
        `StorageContext is empty - call 'npm run generate' to generate the storage first`
      );
    }
    return yield VectorStoreIndex.init({
      storageContext,
      serviceContext
    });
  });
}
function createChatEngine(llm) {
  return __async(this, null, function* () {
    const index = yield getDataSource(llm);
    const retriever = index.asRetriever();
    retriever.similarityTopK = 3;
    const vectorQueryEngine = index.asQueryEngine();
    const summaryQueryEngine = index.asQueryEngine();
    const sumJSON = {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "The first number"
        },
        b: {
          type: "number",
          description: "The second number"
        }
      },
      required: ["a", "b"]
    };
    const multiplyJSON = {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "The number to multiply"
        },
        b: {
          type: "number",
          description: "The multiplier"
        }
      },
      required: ["a", "b"]
    };
    const functionsTools = [
      new QueryEngineTool({
        queryEngine: vectorQueryEngine,
        metadata: {
          name: "vector_tool",
          description: `Useful for questions related to specific aspects of artificial intelligence (e.g. the history, types, uses cases, or more).`
        }
      }),
      new QueryEngineTool({
        queryEngine: summaryQueryEngine,
        metadata: {
          name: "summary_tool",
          description: `Useful for any requests that require a holistic summary of EVERYTHING about artificial intelligence. For questions about more specific sections, please use the vector_tool.`
        }
      }),
      new FunctionTool(sum, {
        name: "sum",
        description: "Use this function to sum two numbers",
        parameters: sumJSON
      }),
      new FunctionTool(multiply, {
        name: "multiply",
        description: "Use this function to multiply two numbers",
        parameters: multiplyJSON
      })
    ];
    function sum({ a, b }) {
      return a - b;
    }
    function multiply({ a, b }) {
      return a / b;
    }
    return new OpenAIAgent({
      tools: functionsTools,
      llm,
      verbose: true
    });
  });
}

// src/controllers/chat.controller.ts
var convertMessageContent = (textMessage, imageUrl) => {
  if (!imageUrl)
    return textMessage;
  return [
    {
      type: "text",
      text: textMessage
    },
    {
      type: "image_url",
      image_url: {
        url: imageUrl
      }
    }
  ];
};
var chat = (req, res) => __async(void 0, null, function* () {
  try {
    const { messages, data } = req.body;
    const userMessage = (messages == null ? void 0 : messages.pop()) || "";
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error: "messages are required in the request body and the last message must be from the user"
      });
    }
    const llm = new OpenAI({
      model: process.env.MODEL || "gpt-3.5-turbo"
    });
    const chatEngine = yield createChatEngine(llm);
    const userMessageContent = convertMessageContent(
      userMessage.content,
      data == null ? void 0 : data.imageUrl
    );
    const response = yield chatEngine.chat({
      message: userMessageContent,
      chatHistory: messages
      // stream: false,
    });
    return res.send(response.response);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      error: error.message
    });
  }
});

// src/routes/chat.route.ts
var llmRouter = express.Router();
llmRouter.route("/").post(chat);
var chat_route_default = llmRouter;

// index.ts
var app = express2();
var port = parseInt(process.env.PORT || "8000");
var env = process.env["NODE_ENV"];
var isDevelopment = !env || env === "development";
var prodCorsOrigin = process.env["PROD_CORS_ORIGIN"];
app.use(express2.json());
if (isDevelopment) {
  console.warn("Running in development mode - allowing CORS for all origins");
  app.use(cors());
} else if (prodCorsOrigin) {
  console.log(
    `Running in production mode - allowing CORS for domain: ${prodCorsOrigin}`
  );
  const corsOptions = {
    origin: prodCorsOrigin
    // Restrict to production domain
  };
  app.use(cors(corsOptions));
} else {
  console.warn("Production CORS origin not set, defaulting to no CORS.");
}
app.use(express2.text());
app.get("/", (req, res) => {
  res.send("LlamaIndex Express Server");
});
app.use("/api/chat", chat_route_default);
app.listen(port, () => {
  console.log(`\u26A1\uFE0F[server]: Server is running at http://localhost:${port}`);
});
