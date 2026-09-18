// Only the self-service journey can override the canonical login destination.
export default function loginReturnPath(value) {
  return value === "/cadastro" ? "/cadastro" : "/menu";
}
