/* eslint-disable react/prop-types */
import React from "react";
import { FaPlus } from "react-icons/fa";

export default function ClinicExpenseCategoriesSection({
  ui,
  loading,
  categories,
  onNew,
  onEdit,
  onActivate,
  onDeactivate,
  updatingId,
}) {
  const {
    Section,
    SectionHeader,
    SectionTitle,
    SectionSubtitle,
    PrimaryButton,
    SectionLoader,
    Spinner,
    EmptyState,
    TableScroll,
    EntriesTable,
    FinancialStatusPill,
    RowActions,
    SmallButton,
  } = ui;

  const renderContent = () => {
    if (loading) {
      return (
        <SectionLoader>
          <Spinner />
          Carregando categorias...
        </SectionLoader>
      );
    }

    if (categories.length === 0) {
      return (
        <EmptyState>
          <p>Nenhuma categoria cadastrada.</p>
        </EmptyState>
      );
    }

    return (
      <TableScroll>
        <EntriesTable>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const isUpdating = updatingId === category.id;
              return (
                <tr key={category.id}>
                  <td>
                    <strong>{category.name}</strong>
                  </td>
                  <td>
                    <FinancialStatusPill $status={category.active ? "paid" : "pending"}>
                      {category.active ? "Ativa" : "Inativa"}
                    </FinancialStatusPill>
                  </td>
                  <td>
                    <RowActions>
                      <SmallButton type="button" onClick={() => onEdit(category)} disabled={isUpdating}>
                        Editar
                      </SmallButton>
                      {category.active ? (
                        <SmallButton type="button" onClick={() => onDeactivate(category)} disabled={isUpdating}>
                          {isUpdating ? "Salvando..." : "Desativar"}
                        </SmallButton>
                      ) : (
                        <SmallButton type="button" onClick={() => onActivate(category)} disabled={isUpdating}>
                          {isUpdating ? "Salvando..." : "Ativar"}
                        </SmallButton>
                      )}
                    </RowActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </EntriesTable>
      </TableScroll>
    );
  };

  return (
    <Section>
      <SectionHeader>
        <div>
          <SectionTitle>Categorias de despesas</SectionTitle>
          <SectionSubtitle>Organize os tipos de despesas usados pela clínica.</SectionSubtitle>
        </div>
        <PrimaryButton type="button" onClick={onNew}>
          <FaPlus />
          Nova categoria
        </PrimaryButton>
      </SectionHeader>
      {renderContent()}
    </Section>
  );
}
