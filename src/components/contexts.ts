import React from "react";
import type { App } from "@modelcontextprotocol/ext-apps";
import { Model } from "../state/model.ts";

export const FSContext = React.createContext<FS | undefined>(undefined);

export const ModelContext = React.createContext<Model | null>(null);

export const McpContext = React.createContext<App | null>(null);

