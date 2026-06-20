export const ZED_EXTENSION_ID = "slate";
export const ZED_EXTENSION_NAME = "Slate";
export const ZED_LANGUAGE_NAME = "Slate";
export const ZED_LANGUAGE_SERVER_ID = "slate-language-server";

export type BinarySpec = {
  command: string;
  args: string[];
};

export const DEFAULT_BINARY_SPEC: BinarySpec = {
  command: "bun",
  args: ["{workspace}/node_modules/@slate/language-server/src/index.ts"],
};

export const EXTENSION_TOML = String.raw`id = "${ZED_EXTENSION_ID}"
name = "${ZED_EXTENSION_NAME}"
description = "Slate language support for Zed."
version = "0.0.0"
schema_version = 1
authors = ["Slate contributors"]
repository = "https://example.com/slate"

[language_servers.${ZED_LANGUAGE_SERVER_ID}]
name = "Slate Language Server"
languages = ["${ZED_LANGUAGE_NAME}"]
`;

export const SLATE_LANGUAGE_CONFIG = String.raw`name = "${ZED_LANGUAGE_NAME}"
grammar = "html"
path_suffixes = ["slate"]
`;

export const DEFAULT_ZED_SETTINGS = String.raw`{
  "languages": {
    "${ZED_LANGUAGE_NAME}": {
      "language_servers": ["${ZED_LANGUAGE_SERVER_ID}"]
    }
  },
  "lsp": {
    "${ZED_LANGUAGE_SERVER_ID}": {
      "binary": {
        "path": "${DEFAULT_BINARY_SPEC.command}",
        "arguments": ${JSON.stringify(DEFAULT_BINARY_SPEC.args)}
      }
    }
  }
}`;

export function getExtensionToml(): string {
  return EXTENSION_TOML;
}

export function getLanguageConfigToml(): string {
  return SLATE_LANGUAGE_CONFIG;
}

export function getSuggestedZedSettings(): string {
  return DEFAULT_ZED_SETTINGS;
}
