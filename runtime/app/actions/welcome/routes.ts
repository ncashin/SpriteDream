import { get, post, route } from "remix/routes";

export const welcomeRoutes = route({
  index: get("/"),
  open: post("/open"),
});
