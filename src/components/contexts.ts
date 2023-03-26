import React from "react";
import { Model } from "../state/model";

export const FSContext = React.createContext<FS | undefined>(undefined);

export const ModelContext = React.createContext<Model | null>(null);

