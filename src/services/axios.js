import axios from "axios";

export default axios.create({
  // testes locais
  // baseURL: "http://localhost:3006",

  // subir para produção
  baseURL: ""
});