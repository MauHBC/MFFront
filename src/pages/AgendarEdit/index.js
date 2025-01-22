/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
// import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";

import { get } from "lodash";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import * as actions from "../../store/modules/auth/actions";
import Loading from "../../components/Loading";

import axios from "../../services/axios";
import history from "../../services/history";

// styleds
import { HeroSection } from "../../styles/GlobalStyles";
import {
  PropertyHeader,
  LeftColumn,
  RightColumn,
  Title,
  Form,
} from "./styled";

// Components
import ServiceButton from "../../components/ServiceButton";
import ObservationField from "../../components/ObservationField";

export default function AgendarEdit() {
  const dispatch = useDispatch();
  const location = useLocation();
  const agendamento = location.state?.agendamento || {};

  const [isLoading, setIsLoading] = useState(false);

  // Formatando data recebida da página 'Agendamentos'.
  const dataSemFormatar = agendamento.appointment_date || "";
  function convertToDBFormat(dateStr) {
    const [year, month, day] = dateStr.split("/");
    return `${day}-${month}-${year}`;
  }
  const dataFormatada = convertToDBFormat(dataSemFormatar);

  const [dataAgendamento, setDataAgendamento] = useState(dataFormatada || "");
  const [serviceType, setServiceType] = useState(agendamento.service_id || "");
  const [mobiliado, setMobiliado] = useState(agendamento.mobiliado || "");
  const [acompanhado, setAcompanhado] = useState(agendamento.accompanied_by || "");
  const [keyLocation, setKeyLocation] = useState(agendamento.key_location || "");
  const [observation, setObservation] = useState(agendamento.appointment_observation || "");
  const [obsAcompanhado, setObsAcompanhado] = useState(agendamento.accompanied_obs || "");

  const userAdminId = useSelector((state) =>
    state.auth.user ? state.auth.user.id : "",
  );

  async function handleSubmit(e) {
    e.preventDefault();
    // const chaveAleatoria = uuidv4();

    let formErrors = false;
    if (!dataAgendamento) {
      formErrors = true;
      toast.error("A data do agendamento precisa ser preenchida");
    }

    if (!serviceType) {
      formErrors = true;
      toast.error("Selecione um tipo de serviço");
    }

    if (!mobiliado) {
      formErrors = true;
      toast.error("Selecione se é mobiliado");
    }

    if (!keyLocation) {
      formErrors = true;
      toast.error("Selecione se é mobiliado");
    }

    setIsLoading(false);
    if (formErrors) return;

    // Converter data antes de enviar para o banco
    function convertToISOFormat(dateStr) {
      const [day, month, year] = dateStr.split("/");
      return `${year}-${month}-${day}`;
    }

    // Verificar se o campo de observação foi alterado.
    const adjustedObsAcompanhado = acompanhado === "Sim" ? obsAcompanhado : null;

    try {
      setIsLoading(true);
      const dataAgendamentoISO = convertToISOFormat(dataAgendamento);

      if (agendamento.id) {
        await axios.put(`/appointments/${agendamento.id}`, {
          property_id: agendamento.Property.id,
          appointment_date: dataAgendamentoISO,
          service_id: serviceType,
          appointment_observation: observation,
          status: agendamento.status,
          admin_user_id: userAdminId,
          uuid: agendamento.Property.real_estate_internal_code,
          mobiliado,
          key_location: keyLocation,
          accompanied_by: acompanhado,
          accompanied_obs: adjustedObsAcompanhado,
        });
        toast.success("Agendamento editado com sucesso");
        history.push(`/agendamentos`);
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

  console.log(serviceType);


  return (
    <HeroSection>
      <LeftColumn>
        <Loading isLoading={isLoading}>Carregando...</Loading>

        <PropertyHeader>
          <Title>Imóvel</Title>
          <p>
            <strong>Código interno:</strong>{" "}
            {agendamento.Property.real_estate_internal_code}
          </p>
          <p>
            <strong>Código comercial:</strong>{" "}
            {agendamento.Property.real_estate_commercial_code}
          </p>

          <p>
            <strong>Condomínio:</strong> {agendamento.Property.condominium}
          </p>
          <p>
            <strong>Endereço:</strong> {agendamento.Property.adress},{" "}
            {agendamento.Property.number}
          </p>
          <p>
            <strong>Complemento:</strong> {agendamento.Property.complement}
          </p>
          <p>
            <strong>Bairro:</strong> {agendamento.Property.neighborhood}
          </p>
          <p>
            <strong>Cidade:</strong> {agendamento.Property.city}
          </p>
          <p>
            <strong>Estado:</strong> {agendamento.Property.state}
          </p>
          <p>
            <strong>CEP:</strong> {agendamento.Property.zip_code}
          </p>
        </PropertyHeader>{" "}

      </LeftColumn>
      <RightColumn>
        <Title>Editar Agendamento</Title>
        <Title>{`Código do agendamento: ${agendamento.id}`}</Title>

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
              label="Checklist"
              selected={serviceType === 1}
              onClick={() => setServiceType(1)}
            />
            <ServiceButton
              label="Retorno Checklist"
              selected={serviceType === 2}
              onClick={() => setServiceType(2)}
            />
          </div>

          <div className="tittletext">Mobiliado:</div>
          <div className="serviceTypeButtons">
            <ServiceButton
              label="Sim"
              selected={mobiliado === "Sim"}
              onClick={() => setMobiliado("Sim")}
            />
            <ServiceButton
              label="Não"
              selected={mobiliado === "Não"}
              onClick={() => setMobiliado("Não")}
            />

          </div>

          <div className="tittletext">Localização das chaves:</div>
          <div className="serviceTypeButtons">
            <ServiceButton
              label="Jardim da Penha"
              selected={keyLocation === "Jardim da Penha"}
              onClick={() => setKeyLocation("Jardim da Penha")}
            />
            <ServiceButton
              label="Jardim Camburi"
              selected={keyLocation === "Jardim Camburi"}
              onClick={() => setKeyLocation("Jardim Camburi")}
            />
            <ServiceButton
              label="Serra"
              selected={keyLocation === "Serra"}
              onClick={() => setKeyLocation("Serra")}
            />
            <ServiceButton
              label="Vila Velha Praia da Costa"
              selected={keyLocation === "Vila Velha Praia da Costa"}
              onClick={() => setKeyLocation("Vila Velha Praia da Costa")}
            />
            <ServiceButton
              label="Vila Velha Itaparica"
              selected={keyLocation === "Vila Velha Itaparica"}
              onClick={() => setKeyLocation("Vila Velha Itaparica")}
            />
            <ServiceButton
              label="Cariacica"
              selected={keyLocation === "Cariacica"}
              onClick={() => setKeyLocation("Cariacica")}
            />
          </div>

          <div className="tittletext">Será acompanhado?</div>
          <div className="serviceTypeButtons">
            <ServiceButton
              label="Sim"
              selected={acompanhado === "Sim"}
              onClick={() => setAcompanhado("Sim")}
            />
            <ServiceButton
              label="Não"
              selected={acompanhado === "Não"}
              onClick={() => setAcompanhado("Não")}
            />

          </div>

          {acompanhado === "Sim" && (
            <ObservationField
              id="acompanhadoObservacao"
              label="Observação sobre acompanhado (informar nome e contato):"
              value={obsAcompanhado}
              onChange={(e) => setObsAcompanhado(e.target.value)}
            />
          )}

          <ObservationField
            id="observation"
            label="Observação do imóvel:"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
          />
          <button type="submit">Salvar alterações</button>
        </Form>
      </RightColumn>
    </HeroSection>
  );
}

AgendarEdit.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
