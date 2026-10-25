declare function createAccessWorker(config: { issuer: string; audience: string }): {
  fetch(
    request: Request,
    env: { ASSETS: { fetch(request: Request): Promise<Response> } },
  ): Promise<Response>;
};
export default createAccessWorker;
