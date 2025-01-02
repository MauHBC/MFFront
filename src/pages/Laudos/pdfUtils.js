import { get } from "lodash";
import { toast } from "react-toastify";
import axios from "../../services/axios";
import * as actions from "../../store/modules/auth/actions";

export async function handleGenPdf(id, dispatch, setIsLoading) {
  setIsLoading(true);
  try {
    const response = await axios.get(`/appointments/generateReport/${id}`, {
      responseType: 'blob',
    });

    const contentDisposition = response.headers['content-disposition'];

    const fileNameMatch = contentDisposition?.match(/filename\*?=['"]?UTF-8['"]?''([^;]+)|filename="?([^;"]+)"/);
    const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1] || fileNameMatch[2]) : `relatorio_${id}.pdf`;

    const url = window.URL.createObjectURL(new Blob([response.data]));

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error(err);

    const status = get(err, "response.status", 0);
    const dataerr = get(err, "response.data", {});
    const errors = get(dataerr, "errors", []);

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
    } else {
      toast.error("Erro desconhecido");
    }

    if (status === 401) dispatch(actions.loginFailure());
  } finally {
    setIsLoading(false);
  }
}
