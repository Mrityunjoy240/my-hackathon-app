"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";


interface Message {
  id: number;
  text: string;
  sender: "user" | "ai";
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // In Next.js 15+, params is a Promise — use React.use() to unwrap it in Client Components
  use(params);

  const t = useTranslations("Chat");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (input.trim() === "" || loading) return;

    const userMessage: Message = { id: Date.now(), text: input, sender: "user" };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiMessage: Message = { id: Date.now() + 1, text: data.response, sender: "ai" };
      setMessages((prevMessages) => [...prevMessages, aiMessage]);
    } catch {
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Error: Could not get a response from the AI.",
        sender: "ai",
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <header className="py-4 border-b">
        <h1 className="text-2xl font-bold">College AI Chat</h1>
      </header>
      
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${ message.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs p-3 rounded-lg ${ message.sender === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"}`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-xs p-3 rounded-lg bg-gray-200 text-gray-800">
              AI is thinking...
            </div>
          </div>
        )}
        {!messages.length && !loading && (
          <p className="text-muted-foreground text-center italic">
            Start a conversation below.
          </p>
        )}
      </div>
      
      <footer className="py-4">
        <div className="relative">
          <input
            type="text"
            placeholder={t("placeholder")}
            className="w-full p-4 pr-24 rounded-lg border focus:ring-2 focus:ring-primary outline-none"
            onKeyDown={handleKeyPress}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button 
            className="absolute right-2 top-2 bottom-2 px-4 bg-black text-white rounded-md"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
