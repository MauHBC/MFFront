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
  PaginationContainer, PaginationButton, PaginationInfo
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

  // Páginação
  const [currentPage, setCurrentPage] = useState(1); // Página atual
  const [totalPages, setTotalPages] = useState(1); // Total de páginas
  const [totalCount, setTotalCount] = useState(0); // Total de registros


  useEffect(() => {
    async function fetchProperties() {
      try {
        setIsLoading(true);

        const response = await axios.get("/property/showproperty", {
          params: {
            real_estate: userRealEstateName,
            page: currentPage, // Página atual
            limit: 10, // Limite de imóveis por página
          },
        });

        if (response.data && Array.isArray(response.data.properties)) {
          setProperties(response.data.properties);
          setTotalPages(response.data.totalPages);
          setTotalCount(response.data.totalCount);
        } else {
          toast.error("Erro desconhecido na resposta do servidor");
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao buscar imóveis");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProperties();
  }, [userRealEstateName, currentPage]); // Reexecuta a cada mudança de página


  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };


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
          novo imóvel{" "}
        </Link>

      </LeftColumn>
      <RightColumn>
        <Title>Imóveis encontrados</Title>

        <PaginationContainer>
          <PaginationButton
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Anterior
          </PaginationButton>

          <PaginationInfo>{`Página ${currentPage} de ${totalPages}`}</PaginationInfo>

          <PaginationButton
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Próxima
          </PaginationButton>
        </PaginationContainer>

        <div>
          <p>Total de imóveis encontrados: {totalCount}</p>
        </div>

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
