export const providerAdapterRegistry = Object.freeze({
  "github-cli-api": Object.freeze({ providerId: "github", version: "1.0.0", operations: Object.freeze(["git.push", "pull-request.create", "pull-request.review", "release.publish"]), locatorKinds: Object.freeze(["provider-native"]), readOnly: true }),
  "git-ssh": Object.freeze({ providerId: "git", version: "1.0.0", operations: Object.freeze(["git.fetch", "git.push"]), locatorKinds: Object.freeze(["provider-native"]), readOnly: true }),
  "npm-registry": Object.freeze({ providerId: "npm", version: "1.0.0", operations: Object.freeze(["package.inspect", "package.publish"]), locatorKinds: Object.freeze(["workspace-file", "related-workspace-file", "environment-variable", "provider-native"]), readOnly: true }),
});
