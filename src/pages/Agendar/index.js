/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";


import { get } from "lodash";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import Header from "../../components/ImobNavbar/index";
import * as actions from "../../store/modules/auth/actions";

import axios from "../../services/axios";
import history from "../../services/history";
import {
  PropertyHeader,
  HeroSection,
  LeftColumn,
  RightColumn,
  Title,
  Form,
  ServiceButton,
} from "./styled";
import Loading from "../../components/Loading";

export default function Agendar({ match }) {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [observation, setObservation] = useState("");
  const userAdminId = useSelector((state) =>
    state.auth.user ? state.auth.user.id : "",
  );
  const propertyData = useSelector((state) => {
    return state.realEstateData.realEstateData;
  });

  const id = get(match, "params.id", "");

  function handleServiceSelection(typeId) {
    setServiceType(typeId);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const chaveAleatoria = uuidv4();

    let formErrors = false;
    if (!dataAgendamento) {
      formErrors = true;
      toast.error("A data do agendamento precisa ser preenchida");
    }
    if (!serviceType) {
      formErrors = true;
      toast.error("Selecione um tipo de serviço");
    }

    setIsLoading(false);
    if (formErrors) return;

    function convertToISOFormat(dateStr) {
      const [day, month, year] = dateStr.split("/");
      return `${year}-${month}-${day}`;
    }

    try {
      setIsLoading(true);
      const dataAgendamentoISO = convertToISOFormat(dataAgendamento);

      if (id) {
        await axios.post("/appointments/", {
          property_id: propertyData.id,
          appointment_date: dataAgendamentoISO,
          service_id: serviceType,
          appointment_observation: observation,
          status: "Agenda Geral",
          admin_user_id: userAdminId,
          uuid: chaveAleatoria,
          mobiliado: "Sim",
          key_location: "Loja",
          accompanied_by: "No one",
        });
        toast.success("Imóvel agendado com sucesso");
        history.push("/agendamentos");
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
    <Header>

      <HeroSection>
        <LeftColumn>
          <Loading isLoading={isLoading}>Carregando...</Loading>
          <PropertyHeader>
            <Title>Imobiliária</Title>
            <p>
              <strong>Imobiliária:</strong> {propertyData.real_estate}
            </p>
            <p>
              <strong>Código interno:</strong>{" "}
              {propertyData.real_estate_internal_code}
            </p>
            <p>
              <strong>Código comercial:</strong>{" "}
              {propertyData.real_estate_commercial_code}
            </p>
          </PropertyHeader>
          <PropertyHeader>
            <Title>Imóvel</Title>
            <p>
              <strong>Condomínio:</strong> {propertyData.condominium}
            </p>
            <p>
              <strong>Endereço:</strong> {propertyData.adress},{" "}
              {propertyData.number}
            </p>
            <p>
              <strong>Complemento:</strong> {propertyData.complement}
            </p>
            <p>
              <strong>Bairro:</strong> {propertyData.neighborhood}
            </p>
            <p>
              <strong>Cidade:</strong> {propertyData.city}
            </p>
            <p>
              <strong>Estado:</strong> {propertyData.state}
            </p>
            <p>
              <strong>CEP:</strong> {propertyData.zipcode}
            </p>
          </PropertyHeader>{" "}
        </LeftColumn>
        <RightColumn>
          <Title>Agendamento</Title>
          <Form onSubmit={(e) => handleSubmit(e)}>
            <div className="tittletext">Data do agendamento:</div>
            <input
              type="date"
              value={dataAgendamento}
              onChange={(e) => setDataAgendamento(e.target.value)}
            />
            <div className="tittletext">Tipo de serviço:</div>
            <div className="serviceTypeButtons">
              <ServiceButton
                type="button"
                selected={serviceType === 1}
                onClick={() => handleServiceSelection(1)}
              >
                Checklist
              </ServiceButton>
              <ServiceButton
                type="button"
                selected={serviceType === 2}
                onClick={() => handleServiceSelection(2)}
              >
                Solicitação Avulsa
              </ServiceButton>
            </div>
            <div className="observationField">
              <label htmlFor="observation">Observação Interna:</label>
              <textarea
                id="observation"
                name="observation"
                rows="4"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
            </div>{" "}
            <button type="submit">Agendar</button>
          </Form>
        </RightColumn>
      </HeroSection>
    </Header>
  );
}

Agendar.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
