import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { parse, compareDesc, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HeroSection } from "../../styles/GlobalStyles";
import { handleGenPdf } from "./pdfUtils";
import { handleSubmit } from "./formUtils";
import "react-datepicker/dist/react-datepicker.css";

// hooks
import { useRealEstate } from "../../hooks/useRealEstate";

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
  const userRealEstateName = useRealEstate();
  const dispatch = useDispatch();

  const [realEstateInternalCode, setRealEstateInternalCode] = useState("");
  const [realEstateCommercialCode, setRealEstateCommercialCode] = useState("");
  const [condominium, setCondominium] = useState("");
  const [adress, setAdress] = useState("");
  const [LaudosCompletos, setLaudosCompletos] = useState([]);
  const [selectedAppointments, setSelectedAppointments] = useState([]);

  useEffect(() => {
    async function fetchRealEstates() {
      setIsLoading(true);
      const response = await axios.get("/appointments/filterByRealEstateEnviados7dias", {
        params: {
          real_estate: userRealEstateName.toString(),
        },
      });
      setLaudosCompletos(response.data);
      setIsLoading(false);
    }
    fetchRealEstates();
  }, [userRealEstateName]);

  async function handleGenMultiplePdfs() {
    setIsLoading(true);
    console.log("IDs selecionados:", selectedAppointments);

    try {
      await Promise.all(selectedAppointments.map((id) => handleGenPdf(id, dispatch, setIsLoading)));
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

  // Agrupar os laudos por data
  const groupedLaudos = LaudosCompletos.reduce((acc, laudo) => {
    const dateKey = laudo.appointment_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(laudo);
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
              setLaudosCompletos,
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
        </TitleContainer>

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
                {groupedLaudos[date].map((laudo) => (
                  <ListProp key={String(laudo.id)}>
                    <div className="propertylist">
                      <div className="propertyListResult">
                        <span>
                          <strong>Cód CheckPoint:</strong> {laudo.id}, <strong>Serviço:</strong> {laudo.Service.service}.&nbsp;
                        </span>
                        <span>
                          <strong>Cód Int Imobiliária:</strong> {laudo.Property.real_estate_internal_code}.&nbsp;
                        </span>
                        <span>
                          <strong>Endereço:</strong> {laudo.Property.adress}, <strong>Nº:</strong> {laudo.Property.number}.&nbsp;
                        </span>
                        <span>
                          <strong>Condomínio:</strong> {laudo.Property.condominium}, {laudo.Property.complement}&nbsp;
                        </span>
                        <span>
                          <strong>Local:</strong> {laudo.Property.neighborhood}, {laudo.Property.city}&nbsp;&nbsp;
                        </span>
                      </div>

                      <Actions>
                        <StyledCheckbox
                          type="checkbox"
                          checked={selectedAppointments.includes(laudo.id)}
                          onChange={() => handleCheckboxChange(laudo.id)}
                        />
                        <button
                          type="button"
                          className="schedule-btn"
                          onClick={() => handleGenPdf(laudo.id, dispatch, setIsLoading)}
                        >
                          Relatório
                        </button>
                      </Actions>
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

Laudos.propTypes = {
  match: PropTypes.shape({}).isRequired,
};
