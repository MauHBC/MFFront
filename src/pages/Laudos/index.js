/* eslint-disable no-alert */
import React, { useState, useEffect } from "react";
import { get } from "lodash";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { parse, compareDesc } from "date-fns";
import * as actions from "../../store/modules/auth/actions";
import { HeroSection } from "../../styles/GlobalStyles";

import {
  Title,
  TitleContainer,
  ButtonWrapper,
  Actions,
  StyledCheckbox,
  Form,
  ListProp,
  RightColumn,
  LeftColumn,
} from "./styled";
import axios from "../../services/axios";

import Loading from "../../components/Loading";

export default function Laudos() {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();

  const [realEstateInternalCode, setRealEstateInternalCode] = useState("");
  const [realEstateCommercialCode, setRealEstateCommercialCode] = useState("");
  const [condominium, setCondominium] = useState("");
  const [adress, setAdress] = useState("");
  const [LaudosCompletos, setLaudosCompletos] = useState([]);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const userRealEstateName = useSelector(
    (state) => state.auth.user.real_estate_names,
  );

  useEffect(() => {
    async function fetchRealEstates() {
      setIsLoading(true);
      const response = await axios.get("/appointments/filterByRealEstate", {
        params: {
          real_estate: userRealEstateName.toString(),
        },
      });
      setLaudosCompletos(response.data);
      setIsLoading(false);
    }
    fetchRealEstates();
  }, [userRealEstateName]);

  async function handleSubmit(e) {
    e.preventDefault();

    setIsLoading(true);

    try {
      console.log({
        real_estate: userRealEstateName.toString(),
        real_estate_internal_code: realEstateInternalCode,
        real_estate_commercial_code: realEstateCommercialCode,
        adress,
        condominium,
      });

      const response = await axios.get("/appointments/filterByRealEstate", {
        params: {
          real_estate: userRealEstateName.toString(),
          real_estate_internal_code: realEstateInternalCode,
          real_estate_commercial_code: realEstateCommercialCode,
          adress,
          condominium,
        },
      });

      if (Array.isArray(response.data)) {
        toast.success("Laudos recebidos");
        setLaudosCompletos(response.data);
      } else {
        toast.error("Erro desconhecido");
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
  }

  async function handleGenPdf(id) {
    try {
      const response = await axios.get(`/appointments/generateReport/${id}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `relatorio_${id}.pdf`); // Nome do arquivo
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.log(err);

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

  async function handleGenMultiplePdfs() {
    setIsLoading(true);
    try {
      await Promise.all(selectedAppointments.map((id) => handleGenPdf(id)));
      toast.success("Relatórios gerados com sucesso");
      setSelectedAppointments([]);
    } catch (error) {
      toast.error("Erro ao gerar relatórios");
    } finally {
      setIsLoading(false);
    }
  }

  function handleCheckboxChange(id) {
    setSelectedAppointments((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((itemId) => itemId !== id)
        : [...prevSelected, id],
    );
  }

  return (
    <HeroSection>
      <LeftColumn>
        <Form onSubmit={(e) => handleSubmit(e)}>
          <Loading isLoading={isLoading} />
          <Title>Menu</Title>
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
      </LeftColumn>

      <RightColumn>
        <TitleContainer>
          <Title>Laudos</Title>
          <ButtonWrapper>
            <button
              type="button"
              onClick={handleGenMultiplePdfs}
              disabled={selectedAppointments.length === 0}
            >
              Gerar Relatórios Selecionados
            </button>
          </ButtonWrapper>
        </TitleContainer>{" "}
        {Array.isArray(LaudosCompletos) &&
          LaudosCompletos.sort((a, b) =>
            compareDesc(
              parse(a.appointment_date, "dd/MM/yyyy", new Date()),
              parse(b.appointment_date, "dd/MM/yyyy", new Date()),
            ),
          ).map((laudos) => (
            <ListProp key={String(laudos.id)}>
              <div className="propertylist">
                <div className="propertyListResult">
                  <span>CCP: {laudos.id}.&nbsp;</span>
                  <span>Data: {laudos.appointment_date}.&nbsp;</span>
                  <span className="spacing">
                    Código Int Imobiliária:{" "}
                    {laudos.Property.real_estate_internal_code}.&nbsp;
                  </span>{" "}
                  <span>
                    Código Ext Imobiliária:{" "}
                    {laudos.Property.real_estate_commercial_code}.&nbsp;
                  </span>
                  <span>service: {laudos.Service.service}.&nbsp;</span>
                  <span>Endereço: {laudos.Property.adress}.&nbsp;</span>
                  <span>Condomínio: {laudos.Property.condominium}.&nbsp;</span>
                </div>

                <Actions>
                  <StyledCheckbox
                    type="checkbox"
                    checked={selectedAppointments.includes(laudos.id)}
                    onChange={() => handleCheckboxChange(laudos.id)}
                  />
                  <button
                    type="button"
                    className="schedule-btn"
                    onClick={() => handleGenPdf(laudos.id)}
                  >
                    Relatório
                  </button>
                </Actions>
              </div>
            </ListProp>
          ))}
      </RightColumn>
    </HeroSection>
  );
}

Laudos.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
