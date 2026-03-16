import axios from "axios";

export default axios.create({
  // testes locais
  baseURL: "http://localhost:3006/api",

  // produção
  // baseURL: "/api",
});
