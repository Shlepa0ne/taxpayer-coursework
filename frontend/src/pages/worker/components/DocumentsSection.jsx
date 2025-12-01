// frontend/src/pages/worker/components/DocumentsSection.jsx
import React, { useState, useEffect } from 'react';
import { formatDate } from '../../../utils/formatters';

const DocumentsSection = ({ 
  documents, 
  taxpayerId, 
  canEdit, 
  onAddDocument, // ДОБАВЛЕНО
  onEditDocument, // ДОБАВЛЕНО
  onDeleteDocument // ДОБАВЛЕНО
}) => {
  useEffect(() => {
    console.log('DocumentsSection received documents:', documents);
  }, [documents]);

  return (
    <div>
      {canEdit && (
        <div className="mb-3">
          <button 
            className="btn btn-primary"
            onClick={() => onAddDocument()}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Добавить документ
          </button>
        </div>
      )}

      {documents.length > 0 ? (
        <div className="row">
          {documents.map(doc => (
            <div key={doc.document_id} className="col-md-6 mb-3">
              <div className="card border">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">{doc.document_type_name}</h6>
                  {canEdit && (
                    <div className="btn-group btn-group-sm">
                      <button 
                        className="btn btn-outline-primary"
                        onClick={() => onEditDocument(doc)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn btn-outline-danger"
                        onClick={() => onDeleteDocument(doc.document_id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
                <div className="card-body">
                  <div className="mb-2">
                    <strong>Серия/Номер:</strong> {doc.series} {doc.number}
                  </div>
                  {doc.issued_by && (
                    <div className="mb-2">
                      <strong>Кем выдан:</strong> {doc.issued_by}
                    </div>
                  )}
                  {doc.issued_date && (
                    <div className="mb-2">
                      <strong>Дата выдачи:</strong> {formatDate(doc.issued_date)}
                    </div>
                  )}
                  {doc.expire_date && (
                    <div className="mb-2">
                      <strong>Действителен до:</strong> {formatDate(doc.expire_date)}
                    </div>
                  )}
                  {doc.additional_info && (
                    <div className="mb-0">
                      <strong>Доп. информация:</strong> {doc.additional_info}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted py-4">
          <i className="bi bi-file-earmark-x display-4"></i>
          <p className="mt-2">Документы не найдены</p>
        </div>
      )}
    </div>
  );
};

export default DocumentsSection;