import React, { Dispatch, SetStateAction } from "react";
import { Model } from "../state/model";
import { FileSystemContextInterface } from "../fs/base-filesystem";

export const FSContext = React.createContext<FS | undefined>(undefined);
export const FileSystemContext = React.createContext<FileSystemContextInterface | undefined>(undefined);

export const ModelContext = React.createContext<Model | null>(null);

