/* eslint-disable no-alert */
import React, { useState, useEffect } from "react";
import { get } from "lodash";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { HeroSection } from "../../styles/GlobalStyles";
import * as actions from "../../store/modules/auth/actions";
// import * as actionsRealEstateData from "../../store/modules/realestatedata/actions";

// hooks
import { useRealEstate } from "../../hooks/useRealEstate";

import {
  Title,
  Form,
  ListProp,
  RightColumn,
  LeftColumn,
} from "./styled";
import axios from "../../services/axios";

import Loading from "../../components/Loading";

export default function Imoveis() {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();

  const userRealEstateName = useRealEstate();
  const [realEstate, setRealEstate] = useState("");
  const [properties, setProperties] = useState([]);
  const [realEstateInternalCode, setRealEstateInternalCode] = useState("");
  const [realEstateCommercialCode, setRealEstateCommercialCode] = useState("");
  const [condominium, setCondominium] = useState("");
  const [adress, setAdress] = useState("");

  useEffect(() => {
    async function fetchProperties() {
      try {
        setIsLoading(true);

        // Realizar a requisição de busca de imóveis
        const response = await axios.get("/property/showproperty", {
          params: {
            real_estate: userRealEstateName,
          },
        });

        if (Array.isArray(response.data)) {
          setProperties(response.data); // Atualiza o estado com os imóveis retornados
        } else {
          toast.error("Erro desconhecido na resposta do servidor");
        }
      } catch (err) {
        console.error(err);
        const status = get(err, "response.status", 0);
        if (status === 401) dispatch(actions.loginFailure());
        toast.error("Imóveis encontrados");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProperties();
  }, [userRealEstateName, dispatch]);

  // const handleAgendar = (property) => {
  //   dispatch(actionsRealEstateData.realEstateData({ data: property }));
  // };

  async function handleDelete(e, id, index) {
    e.persist();
    try {
      setIsLoading(true);
      await axios.delete(`/property/${id}`);
      const newsProperties = [...properties];
      newsProperties.splice(index, 1);
      setProperties(newsProperties);
      setIsLoading(false);
    } catch (err) {
      const status = get(err, "response.status", 0);

      if (status === 401) {
        toast.error("Você precisa afzer login");
      } else {
        toast.error("Ocorreu um erro ao excluir o imóvel");
      }

      setIsLoading(false);
    }
  }

  function handleDeleteAsk(e, id, index) {
    e.preventDefault();
    const confirmation = window.confirm(
      "Tem certeza de que deseja excluir este imóvel?",
    );
    if (confirmation) {
      handleDelete(e, id, index);
    }
  }

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
          real_estate: userRealEstateName,
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
        <Loading isLoading={isLoading} />

        <Title>Buscar imóvel</Title>

        <Form onSubmit={(e) => handleSubmit(e)}>
          <div className="tittletext">Imobiliária</div>
          <input value={userRealEstateName} disabled />
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
        <Link
          className="schedule-btn"
          to="/imovel/"
        >
          Cadastrar novo imóvel{" "}
        </Link>

      </LeftColumn>
      <RightColumn>
        <Title>Imóveis encontrados</Title>
        {Array.isArray(properties) &&
          properties.map((property, index) => (
            <ListProp key={String(property.id)}>
              <div className="propertylist">
                <div className="propertyListResult">
                  <span>
                    Cód interno: {property.real_estate_internal_code}.&nbsp;
                  </span>
                  <span>
                    Cód comercial: {property.real_estate_commercial_code}.&nbsp;
                  </span>
                  <span>Condomíio: {property.condominium}.&nbsp;</span>
                  <span>Endereço: {property.adress}.&nbsp;</span>
                  <span>Número: {property.number}.&nbsp;</span>
                  <span>Complemento: {property.complement}.&nbsp;</span>
                </div>

                <div className="action-buttons">
                  <Link
                    className="schedule-btn"
                    to={{
                      pathname: `/agendamentos/${property.id}/agendar`,
                      state: { property },
                    }}
                  >
                    Agendar
                  </Link>


                  <Link
                    className="edit"
                    to={{
                      pathname: `/imovel/${property.id}/edit`,
                    }}
                  >
                    Editar
                  </Link>

                  <Link
                    className="delete"
                    onClick={(e) => handleDeleteAsk(e, property.id, index)}
                    to={`/property/${property.id}/delete`}
                  >
                    Excluir
                  </Link>
                </div>
              </div>
            </ListProp>
          ))}
      </RightColumn>
    </HeroSection>
  );
}

Imoveis.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
