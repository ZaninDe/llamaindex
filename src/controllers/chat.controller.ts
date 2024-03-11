import { Request, Response } from "express";
import { ChatMessage, MessageContent, OpenAI } from "llamaindex";
import { createChatEngine } from "./engine";

const convertMessageContent = (
  textMessage: string,
  imageUrl: string | undefined,
): MessageContent => {
  if (!imageUrl) return textMessage;
  return [
    {
      type: "text",
      text: textMessage,
    },
    {
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    },
  ];
};

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages, data }: { messages: ChatMessage[]; data: any } = req.body;
    const userMessage = messages?.pop() || "";
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    const llm = new OpenAI({
      model: (process.env.MODEL as any) || "gpt-3.5-turbo",
    });

    const chatEngine = await createChatEngine(llm);

    const userMessageContent = convertMessageContent(
      userMessage.content,
      data?.imageUrl,
    );

    const response = await chatEngine.chat({
      message: userMessageContent,
      chatHistory: messages,
      stream: false,
    });

    return res.send(response.response)
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      error: (error as Error).message,
    });
  }
};
