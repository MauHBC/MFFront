import React, { useEffect, useState } from "react";
import { get } from "lodash";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { isInt } from "validator";
import { useDispatch } from "react-redux";
import * as actions from "../../store/modules/auth/actions";

import axios from "../../services/axios";
import history from "../../services/history";
import { Container } from "../../styles/GlobalStyles";
import { Form, Title, Voltar } from "./styled";
import Loading from "../../components/Loading";

export default function Imovel({ match }) {
  const dispatch = useDispatch();

  const id = get(match, "params.id", "");
  const [condominium, setCondominium] = useState("");
  const [adress, setAdress] = useState("");
  const [complement, setComplement] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [realEstate, setRealEstate] = useState("");
  const [realEstateInternalCode, setRealEstateInternalCode] = useState("");
  const [realEstateCommercialCode, setRealEstateCommercialCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // to fill form with the data
  useEffect(() => {
    if (!id) return;

    async function getData() {
      try {
        setIsLoading(true);

        const { data } = await axios.get(`/property/${id}`);
        setCondominium(data.Condomínio);
        setAdress(data.adress);
        setComplement(data.complement);
        setNumber(data.number);
        setNeighborhood(data.neighborhood);
        setCity(data.city);
        setState(data.state);
        setZipcode(data.zipcode);
        setRealEstate(data.real_estate);
        setRealEstateInternalCode(data.real_estate_internal_code);
        setRealEstateCommercialCode(data.real_estate_commercial_code);

        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        const status = get(err, "response.status", 0);
        const errors = get(err, "response.data.erros", []);

        if (status === 400) errors.map((error) => toast.error(error));
        history.push("/");
      }
    }

    getData();
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();

    let formErrors = false;

    if (condominium.length < 3 || condominium.length > 255) {
      formErrors = true;
      toast.error("Condomínio deve ter 3 caracteres");
    }
    if (adress.length < 3 || adress.length > 255) {
      formErrors = true;
      toast.error("Endereço deve ter 3 caracteres");
    }
    if (complement.length < 3 || complement.length > 255) {
      formErrors = true;
      toast.error("Complemento deve ter 3 caracteres");
    }
    if (!isInt(String(number))) {
      formErrors = true;
      toast.error("Número inválido");
    }
    if (neighborhood.length < 3 || neighborhood.length > 255) {
      formErrors = true;
      toast.error("Bairro deve ter 3 caracteres");
    }
    if (city.length < 3 || city.length > 255) {
      formErrors = true;
      toast.error("Cidade deve ter 3 caracteres");
    }
    if (state.length < 3 || state.length > 255) {
      formErrors = true;
      toast.error("Estado deve ter 3 caracteres");
    }
    if (!isInt(String(zipcode))) {
      formErrors = true;
      toast.error("CEP inválido");
    }
    if (realEstate.length < 3 || realEstate.length > 255) {
      formErrors = true;
      toast.error("Imobiliária deve ter 3 caracteres");
    }
    if (
      realEstateInternalCode.length < 3 ||
      realEstateInternalCode.length > 255
    ) {
      formErrors = true;
      toast.error("Cód interno deve ter 3 caracteres");
    }
    if (
      realEstateCommercialCode.length < 3 ||
      realEstateCommercialCode.length > 255
    ) {
      formErrors = true;
      toast.error("Cód comercia deve ter 3 caracteres");
    }

    setIsLoading(false);
    if (formErrors) return;

    try {
      setIsLoading(true);

      if (id) {
        await axios.put(`/property/${id}`, {
          condominium,
          adress,
          complement,
          number,
          neighborhood,
          city,
          state,
          zip_code: zipcode,
          real_estate: realEstate,
          real_estate_internal_code: realEstateInternalCode,
          real_estate_commercial_code: realEstateCommercialCode,
        });
        toast.success("Imóvel editado com sucesso");
        history.push(`/imovel/${id}/edit`);
      } else {
        const { data } = await axios.post(`/property/`, {
          condominium,
          adress,
          complement,
          number,
          neighborhood,
          city,
          state,
          zip_code: zipcode,
          real_estate: realEstate,
          real_estate_internal_code: realEstateInternalCode,
          real_estate_commercial_code: realEstateCommercialCode,
        });
        toast.success("Imóvel criado com sucesso");
        history.push(`/imovel/${data.id}/edit`);
      }

      setIsLoading(false);
    } catch (err) {
      const status = get(err, "response.status", 0);
      const data = get(err, "response.data", {});
      const errors = get(data, "errors", []);

      if (errors.length > 0) {
        console.log(errors);
        errors.map((error) => toast.error(error));
      } else {
        toast.error("Erro desconhecido");
      }

      if (status === 401) dispatch(actions.loginFailure());
    }
  }

  return (
    <Container>
      <Loading isLoading={isLoading}>Carregando...</Loading>

      <Title>{id ? `Editar imóvel CCP: ${id}` : "Nova imóvel"}</Title>

      <Form onSubmit={(e) => handleSubmit(e)}>
        <Voltar to="/imoveis">Voltar</Voltar>

        <div className="tittletext">Imobiliária</div>
        <input
          type="text"
          value={realEstate}
          onChange={(e) => setRealEstate(e.target.value)}
        />

        <div className="tittletext">Código interno</div>
        <input
          type="text"
          value={realEstateInternalCode}
          onChange={(e) => setRealEstateInternalCode(e.target.value)}
        />

        <div className="tittletext">Código comercial</div>
        <input
          type="text"
          value={realEstateCommercialCode}
          onChange={(e) => setRealEstateCommercialCode(e.target.value)}
        />

        <div className="tittletext">CEP</div>
        <input
          type="text"
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value)}
        />

        <div className="tittletext">Endereço</div>
        <input
          type="text"
          value={adress}
          onChange={(e) => setAdress(e.target.value)}
        />

        <div className="tittletext">Número</div>
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />

        <div className="tittletext">Complemento</div>
        <input
          type="text"
          value={complement}
          onChange={(e) => setComplement(e.target.value)}
        />

        <div className="tittletext">Bairro</div>
        <input
          type="text"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
        />

        <div className="tittletext">Cidade</div>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <div className="tittletext">Estado</div>
        <input
          type="text"
          value={state}
          onChange={(e) => setState(e.target.value)}
        />

        <div className="tittletext">Condomínio</div>
        <input
          type="text"
          value={condominium}
          onChange={(e) => setCondominium(e.target.value)}
        />

        <button type="submit">
          {id ? `Editar Imóvel` : "Cadastrar novo Imóvel"}
        </button>
      </Form>
    </Container>
  );
}

Imovel.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
