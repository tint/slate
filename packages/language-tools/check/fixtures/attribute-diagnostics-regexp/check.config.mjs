export default {
  attributeDiagnostics: [
    {
      pattern: /^aria[A-Z]/g,
      severity: "error",
      message: "RegExp matched camel-case aria attribute."
    }
  ]
};
