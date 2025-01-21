import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { parse, compareDesc, format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { handleSubmit } from "./formUtils";
import "react-datepicker/dist/react-datepicker.css";
import axios from "../../services/axios";


// hooks
import { useRealEstate } from "../../hooks/useRealEstate";

// styleds
import {
  Title,
  TitleContainer,
  Form,
  ListProp,
  RightColumn,
  LeftColumn,
} from "./styled";
import { HeroSection } from "../../styles/GlobalStyles";


import Loading from "../../components/Loading";

export default function Agendamentos() {
  const [isLoading, setIsLoading] = useState(false);
  const userRealEstateName = useRealEstate();
  const dispatch = useDispatch();

  const [realEstateInternalCode, setRealEstateInternalCode] = useState("");
  const [realEstateCommercialCode, setRealEstateCommercialCode] = useState("");
  const [condominium, setCondominium] = useState("");
  const [adress, setAdress] = useState("");

  // Estados de semana
  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [agendamentos, setAgendamentos] = useState([]);

  useEffect(() => {
    async function fetchAgendamentos() {
      setIsLoading(true);
      try {
        const formattedStartDate = format(startDate, "yyyy-MM-dd");
        const formattedEndDate = format(endDate, "yyyy-MM-dd");

        const response = await axios.get("/appointments/filterByWeek", {
          params: {
            real_estate: userRealEstateName.toString(),
            start_date: formattedStartDate,
            end_date: formattedEndDate,
          },
        });

        setAgendamentos(response.data);
      } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
      }
      setIsLoading(false);
    }

    fetchAgendamentos();
  }, [userRealEstateName, startDate, endDate]);


  // Agrupar os laudos por data
  const groupedLaudos = agendamentos.reduce((acc, agendamento) => {
    const dateKey = agendamento.appointment_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(agendamento);
    return acc;
  }, {});


  return (
    <HeroSection>
      <LeftColumn>
        <Form
          onSubmit={(e) =>
            handleSubmit(
              e,
              userRealEstateName,
              realEstateInternalCode,
              realEstateCommercialCode,
              adress,
              condominium,
              setIsLoading,
              setAgendamentos,
              dispatch
            )
          }
        >
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
          <Title> Agendamentos </Title>
        </TitleContainer>
        <div className="filter-container">
          <button
            type="button"
            onClick={() => {
              setStartDate(subWeeks(startDate, 1));
              setEndDate(subWeeks(endDate, 1));
            }}
          >
            &lt; Semana Anterior
          </button>
          <span>
            {`Semana de ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`}
          </span>
          <button
            type="button"
            onClick={() => {
              setStartDate(addWeeks(startDate, 1));
              setEndDate(addWeeks(endDate, 1));
            }}
          >
            Próxima Semana &gt;
          </button>
        </div>

        {Object.keys(groupedLaudos)
          .sort((a, b) =>
            compareDesc(
              parse(a, "dd/MM/yyyy", new Date()),
              parse(b, "dd/MM/yyyy", new Date())
            )
          )
          .map((date) => {
            const parsedDate = parse(date, "dd/MM/yyyy", new Date());
            const formattedDate = format(parsedDate, "dd/MM/yyyy");
            const weekDay = format(parsedDate, "EEEE", { locale: ptBR });
            return (
              <div key={date}>
                <h3 className="DateTitle">
                  {`${formattedDate}, ${weekDay.charAt(0).toUpperCase() + weekDay.slice(1)}`}
                </h3>
                {groupedLaudos[date].map((agendamento) => (
                  <ListProp key={String(agendamento.id)}>
                    <div className="propertylist">
                      <div className="propertyListResult">
                        <span>
                          <strong>Cód CheckPoint:</strong> {agendamento.id}, <strong>Serviço:</strong> {agendamento.Service.service}.&nbsp;
                        </span>
                        <span>
                          <strong>Cód Int Imobiliária:</strong> {agendamento.Property.real_estate_internal_code}.&nbsp;
                        </span>
                        <span>
                          <strong>Endereço:</strong> {agendamento.Property.adress}, <strong>Nº:</strong> {agendamento.Property.number}.&nbsp;
                        </span>
                        <span>
                          <strong>Condomínio:</strong> {agendamento.Property.condominium}, {agendamento.Property.complement}&nbsp;
                        </span>
                        <span>
                          <strong>Local:</strong> {agendamento.Property.neighborhood}, {agendamento.Property.city}&nbsp;&nbsp;
                        </span>
                      </div>

                      <div className="action-buttons">
                        <Link className="edit" to={{
                          pathname: `/agendamentos/${agendamento.property_id}/agendarEdit`,
                          state: { agendamento },
                        }}>
                          Editar
                        </Link>
                      </div>
                    </div>
                  </ListProp>
                ))}
              </div>
            );
          })}
      </RightColumn>
    </HeroSection>
  );
}

Agendamentos.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
