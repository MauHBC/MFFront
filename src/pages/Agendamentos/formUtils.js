import { toast } from "react-toastify";
import { get } from "lodash";
import axios from "../../services/axios";
import * as actions from "../../store/modules/auth/actions";

export async function handleSubmit(
  e,
  userRealEstateName,
  realEstateInternalCode,
  realEstateCommercialCode,
  adress,
  condominium,
  setIsLoading,
  setLaudosCompletos,
  dispatch
) {
  e.preventDefault();
  setIsLoading(true);

  try {
    const response = await axios.get("/appointments/filterByRealEstate", {
      params: {
        real_estate: userRealEstateName.toString(),
        real_estate_internal_code: realEstateInternalCode,
        real_estate_commercial_code: realEstateCommercialCode,
        adress,
        condominium,
      },
    });
    console.log(response.data);

    if (Array.isArray(response.data)) {
      toast.success("Laudos recebidos");
      setLaudosCompletos(response.data);
    } else {
      toast.error("Erro desconhecido");
    }
  } catch (err) {
    console.log(err);

    const status = get(err, "response.status", 0);
    const dataerr = get(err, "response.data", {});
    const errors = get(dataerr, "errors", []);

    if (errors.length > 0) {
      errors.map((error) => toast.error(error));
    } else {
      toast.error("Erro desconhecido");
    }

    if (status === 401) dispatch(actions.loginFailure());
  } finally {
    setIsLoading(false);
  }

}
