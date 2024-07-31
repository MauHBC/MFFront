/* eslint-disable no-alert */
import React, { useState, useEffect } from "react";
import { get } from "lodash";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import * as actions from "../../store/modules/auth/actions";
import * as actionsRealEstateData from "../../store/modules/realestatedata/actions";

import { HeroSection } from "../../styles/GlobalStyles";
import { Title, Form, ListProp, RightColumn, LeftColumn } from "./styled";
import axios from "../../services/axios";

import Loading from "../../components/Loading";

export default function Agendamentos() {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();

  const [realEstatelist, setRealEstatelist] = useState([]);
  const [realEstate, setRealEstate] = useState("");
  const [properties, setProperties] = useState([]);
  const [realEstateInternalCode, setRealEstateInternalCode] = useState("");
  const [realEstateCommercialCode, setRealEstateCommercialCode] = useState("");
  const [condominium, setCondominium] = useState("");
  const [adress, setAdress] = useState("");

  useEffect(() => {
    async function fetchRealstates() {
      setIsLoading(true);
      const response = await axios.get("/property/realEstates");
      setRealEstatelist(response.data);
      setIsLoading(false);
    }
    fetchRealstates();
  }, []);

  const handleAgendar = (property) => {
    dispatch(actionsRealEstateData.realEstateData({ data: property }));
    console.log("realEstateData", property);
  };

  async function handleSubmit(e) {
    e.preventDefault();

    let formErrors = false;

    if (
      !realEstate.length &&
      !realEstateInternalCode.length &&
      !realEstateCommercialCode.length &&
      !condominium.length &&
      !adress.length
    ) {
      formErrors = true;
      toast.error("Pelo menos um campo deve ser preenchido");
    }

    setIsLoading(false);
    if (formErrors) return;

    setIsLoading(true);

    try {
      const response = await axios.get("/property/showproperty", {
        params: {
          real_estate: realEstate,
          real_estate_internal_code: realEstateInternalCode,
          real_estate_commercial_code: realEstateCommercialCode,
          condominium,
          adress,
        },
      });

      if (Array.isArray(response.data)) {
        setProperties(response.data);
        toast.success("Imóveis recebidos");
      } else {
        toast.error("Erro desconhecido na resposta do servidor");
      }
    } catch (err) {
      console.log(err);

      const status = get(err, "response.status", 0);
      const dataerr = get(err, "response.dataerr", {});
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

    setRealEstate([]);
    setRealEstateInternalCode("");
    setRealEstateCommercialCode("");
    setCondominium("");
    setAdress("");
  }

  return (
    <HeroSection>
      <LeftColumn>
        <Form onSubmit={(e) => handleSubmit(e)}>
          <Loading isLoading={isLoading} />
          <Title>Buscar imóvel</Title>

          <div className="tittletext">Imobiliária</div>
          <select
            value={realEstate}
            onChange={(e) => setRealEstate(e.target.value)}
          >
            <option value="" disabled>
              Selecione uma imobiliária
            </option>
            {realEstatelist.map((realEstateOption) => (
              <option
                key={realEstateOption.id}
                value={realEstateOption.real_estate}
              >
                {realEstateOption.real_estate}
              </option>
            ))}
          </select>
          <div className="tittletext">Código interno da Imobiliária</div>
          <input
            type="text"
            value={realEstateInternalCode}
            onChange={(e) => setRealEstateInternalCode(e.target.value)}
          />
          <div className="tittletext">Código Comercial da Imobiliária</div>
          <input
            type="text"
            value={realEstateCommercialCode}
            onChange={(e) => setRealEstateCommercialCode(e.target.value)}
          />
          <div className="tittletext">Condomínio</div>
          <input
            type="text"
            value={condominium}
            onChange={(e) => setCondominium(e.target.value)}
          />
          <div className="tittletext">Endereço</div>
          <input
            type="text"
            value={adress}
            onChange={(e) => setAdress(e.target.value)}
          />
          <button type="submit">Buscar Imóvel</button>
        </Form>
      </LeftColumn>
      <RightColumn>
        <Title>Imóveis encontrados</Title>
        {Array.isArray(properties) &&
          properties.map((property, index) => (
            <ListProp key={String(property.id)}>
              <div className="propertylist">
                <div className="propertyListResult">
                  <span>
                    <strong>Cód interno:</strong>{" "}
                    {property.real_estate_internal_code}.&nbsp;
                  </span>
                  <span>
                    <strong>Cód comercial:</strong>{" "}
                    {property.real_estate_commercial_code}.&nbsp;
                  </span>
                  <span>
                    <strong>Endereço:</strong> {property.condominium},{" "}
                    {property.adress}, {property.number}, {property.complement};
                  </span>
                </div>

                <div className="actions">
                  <Link
                    className="schedule-btn"
                    onClick={() => handleAgendar(property, index)}
                    to={`/agendamentos/${property.id}/agendar`}
                  >
                    Agendar{" "}
                  </Link>
                </div>
              </div>
            </ListProp>
          ))}
      </RightColumn>
    </HeroSection>
  );
}
