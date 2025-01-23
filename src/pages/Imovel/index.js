/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { get } from "lodash";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { isInt } from "validator";
import { useDispatch } from "react-redux";
import * as actions from "../../store/modules/auth/actions";

import axios from "../../services/axios";
import history from "../../services/history";
import { HeroSection } from "../../styles/GlobalStyles";
import { Form, Title, LeftColumn } from "./styled";
import Loading from "../../components/Loading";

// hooks
import { useRealEstate } from "../../hooks/useRealEstate";

export default function Imovel({ match }) {
  const dispatch = useDispatch();
  const id = get(match, "params.id", "");
  const location = useLocation();
  const property = location.state?.property || {};
  const userRealEstateName = useRealEstate();

  const [condominium, setCondominium] = useState(property.condominium || "");
  const [adress, setAdress] = useState(property.adress || "");
  const [complement, setComplement] = useState(property.complement || "");
  const [number, setNumber] = useState(property.number || "");
  const [neighborhood, setNeighborhood] = useState(property.neighborhood || "");
  const [city, setCity] = useState(property.city || "");
  const [zipcode, setZipcode] = useState(property.zip_code || "");
  const [realEstateInternalCode, setRealEstateInternalCode] = useState(
    property.real_estate_internal_code || ""
  );
  const [realEstateCommercialCode, setRealEstateCommercialCode] = useState(
    property.real_estate_commercial_code || ""
  );

  const [isLoading, setIsLoading] = useState(false);


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
    if (!isInt(String(zipcode))) {
      formErrors = true;
      toast.error("CEP inválido");
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
          state: "Espírito Santo",
          zip_code: zipcode,
          real_estate: userRealEstateName[0],
          real_estate_internal_code: realEstateInternalCode,
          real_estate_commercial_code: realEstateCommercialCode,
        });
        toast.success("Imóvel editado com sucesso");
        history.push(`/imoveis`);
      } else {
        const { data } = await axios.post(`/property/`, {
          condominium,
          adress,
          complement,
          number,
          neighborhood,
          city,
          state: "Espírito Santo",
          zip_code: zipcode,
          real_estate: userRealEstateName[0],
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
    <HeroSection>
      <LeftColumn>
        <Loading isLoading={isLoading}>Carregando...</Loading>

        <Title>{id ? `Editar imóvel` : "Novo imóvel"}</Title>
        <Title>{`${condominium} ${complement}`}</Title>

        <Form onSubmit={(e) => handleSubmit(e)}>
          <fieldset>
            <legend>Informações Básicas</legend>
            <div className="form-group">
              <label htmlFor="realEstateInternalCode">Código Interno da Imobiliária</label>
              <input
                id="realEstateInternalCode"
                type="text"
                value={realEstateInternalCode}
                onChange={(e) => setRealEstateInternalCode(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="realEstateCommercialCode">Código Comercial da Imobiliária</label>
              <input
                id="realEstateCommercialCode"
                type="text"
                value={realEstateCommercialCode}
                onChange={(e) => setRealEstateCommercialCode(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="zipcode">CEP</label>
              <input
                id="zipcode"
                type="text"
                value={zipcode}
                onChange={(e) => setZipcode(e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Endereço</legend>
            <div className="form-group">
              <label htmlFor="adress">Endereço</label>
              <input
                id="adress"
                type="text"
                value={adress}
                onChange={(e) => setAdress(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="number">Número</label>
              <input
                id="number"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="condominium">Condomínio</label>
              <input
                id="condominium"
                type="text"
                value={condominium}
                onChange={(e) => setCondominium(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="complement">Complemento</label>
              <input
                id="complement"
                type="text"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="neighborhood">Bairro</label>
              <input
                id="neighborhood"
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="city">Cidade</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </fieldset>
          <button type="submit">
            {id ? `Editar Imóvel` : "Cadastrar novo Imóvel"}
          </button>
        </Form>
      </LeftColumn>
    </HeroSection>
  );
}

Imovel.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
