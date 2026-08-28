import axios from "./axios";

export function updateOwnAccount({ name, email, password, currentPassword }) {
  return axios.put("/users", {
    name,
    email,
    password: password || undefined,
    current_password: currentPassword || undefined,
  });
}

export function deactivateOwnAccount(currentPassword) {
  return axios.delete("/users", {
    data: { current_password: currentPassword },
  });
}

export default { deactivateOwnAccount, updateOwnAccount };
