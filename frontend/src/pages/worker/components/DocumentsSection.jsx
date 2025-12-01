import React, { useState, useEffect } from 'react';
import { deleteDocument } from '../../../api/workersApi';
import DocumentModal from './DocumentModal';
import { formatDate } from '../../../utils/formatters';

const DocumentsSection = ({ documents, taxpayerId, canEdit, onUpdate }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);

  // ДОБАВИТЬ ОТЛАДОЧНУЮ ИНФОРМАЦИЮ
  useEffect(() => {
    console.log('DocumentsSection received documents:', documents);
    if (documents && documents.length > 0) {
      console.log('First document:', documents[0]);
      console.log('Document type name:', documents[0].document_type_name);
      console.log('Document type id:', documents[0].document_type_id);
    }
  }, [documents]);

  const handleDeleteDocument = async (documentId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот документ?')) {
      try {
        await deleteDocument(documentId);
        onUpdate(taxpayerId);
      } catch (error) {
        console.error('Ошибка при удалении документа:', error);
      }
    }
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-3">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
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
                        onClick={() => setEditingDocument(doc)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn btn-outline-danger"
                        onClick={() => handleDeleteDocument(doc.document_id)}
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

      {/* Модальные окна для добавления/редактирования документов */}
      {(showAddModal || editingDocument) && (
        <DocumentModal
          document={editingDocument}
          taxpayerId={taxpayerId}
          onClose={() => {
            setShowAddModal(false);
            setEditingDocument(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingDocument(null);
            onUpdate(taxpayerId);
          }}
        />
      )}
    </div>
  );
};

export default DocumentsSection;