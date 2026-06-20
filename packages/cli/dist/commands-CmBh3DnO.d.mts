//#region src/commands.d.ts
/**
 * Run the Slate CLI dispatcher.
 *
 * Programmatic consumers should import from `@slate/cli` and call `runInit`,
 * `runBuild`, `runDev`, `runPreview`, or `runCheck` directly.
 */
declare function run(argv?: string[]): Promise<void>;
//#endregion
export { run as t };