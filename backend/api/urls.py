from django.urls import path
from .views import *

urlpatterns = [
    # Эндпоинты для общих (административных) задач
    path('taxpayers/', TaxpayerListAPIView.as_view(), name='taxpayer-list'),
    path('taxpayers/<int:pk>/', TaxpayerDetailAPIView.as_view(), name='taxpayer-detail'),
    path('calculate-risk-score/', CalculateRiskScoreAPIView.as_view(), name='calculate-risk-score'),

    # Эндпоинты для личного кабинета пользователя
    path('my-accruals/', MyTaxAccrualsAPIView.as_view(), name='my-accruals'),
    path('tax-reduce-requests/', CreateTaxReduceRequestAPIView.as_view(), name='create-tax-reduce-request'),
    path('reduce-bases/', ReduceBaseListAPIView.as_view(), name='reduce-base-list'),
    path('auth/login/', TaxpayerLoginAPIView.as_view(), name='auth-login'),
    path('auth/login-workers/', WorkerLoginAPIView.as_view(), name='auth-login-workers'),
    path('auth/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('current-taxpayer/', CurrentTaxpayerAPIView.as_view(), name='current-taxpayer'),
    path('latest-risk-score/', LatestRiskScoreAPIView.as_view(), name='latest-risk-score'),
    path('profile/', ProfileDetailAPIView.as_view(), name='profile-detail'),
    path('change-password/', ChangePasswordAPIView.as_view(), name='change-password'),
    path('my-requests/', MyTaxReduceRequestsAPIView.as_view(), name='my-requests'),
    path('my-taxable-objects/', MyTaxableObjectsAPIView.as_view(), name='my-taxable-objects'),
    path('my-accruals-with-payments/', MyTaxAccrualsWithPaymentsAPIView.as_view(), name='my-accruals-with-payments'),
    path('create-tax-payment/', CreateTaxPaymentAPIView.as_view(), name='create-tax-payment'),
    path('my-declarations/', MyDeclarationsAPIView.as_view(), name='my-declarations'),
    path('declarations/', CreateDeclarationAPIView.as_view(), name='create-declaration'),
    path('tax-types/', TaxTypeListAPIView.as_view(), name='tax-types'),
    path('risk-score-history/', RiskScoreHistoryAPIView.as_view(), name='risk-score-history'),
    
    # Эндпоинты для сотрудников
    path('worker/current/', CurrentWorkerAPIView.as_view(), name='current-worker'),
    path('worker/average-risk-score/', AverageRiskScoreAPIView.as_view(), name='average-risk-score'),
    path('worker/pending-requests-count/', PendingRequestsCountAPIView.as_view(), name='pending-requests-count'),
    path('worker/declarations-count/', DeclarationsCountAPIView.as_view(), name='declarations-count'),
    path('worker/upcoming-inspections-count/', UpcomingInspectionsCountAPIView.as_view(), name='upcoming-inspections-count'),

    # Эндпоинты для поиска налогоплательщиков
    path('worker/taxpayer-search/', TaxpayerSearchAPIView.as_view(), name='taxpayer-search'),
    path('worker/taxpayer/<int:taxpayer_id>/', TaxpayerDetailAPIView.as_view(), name='taxpayer-detail'),
    path('worker/regions/', RegionListAPIView.as_view(), name='region-list'),

    # API для работы с заявлениями
    path('worker/requests-for-review/', WorkerRequestsForReviewAPIView.as_view(), name='worker-requests-for-review'),
    path('worker/requests/<int:pk>/', WorkerRequestDetailAPIView.as_view(), name='worker-request-detail'),
    path('worker/requests/<int:request_id>/update/', WorkerRequestUpdateAPIView.as_view(), name='worker-request-update'),

    # Редактирование данных налогоплательщика
    path('worker/taxpayer/<int:taxpayer_id>/update/', UpdateTaxpayerInfoAPIView.as_view(), name='update-taxpayer-info'),
    
    # Документы
    path('worker/document-types/', DocumentTypeListAPIView.as_view(), name='document-types'),
    path('worker/taxpayer/<int:taxpayer_id>/documents/', CreateDocumentAPIView.as_view(), name='create-document'),
    path('worker/documents/<int:document_id>/', DocumentDetailAPIView.as_view(), name='document-detail'),
    
    # Контакты
    path('worker/contact-types/', ContactTypeListAPIView.as_view(), name='contact-types'),
    path('worker/taxpayer/<int:taxpayer_id>/contacts/', CreateContactAPIView.as_view(), name='create-contact'),
    path('worker/contacts/<int:contact_id>/', ContactDetailAPIView.as_view(), name='contact-detail'),
    
    # Объекты
    path('worker/object-types/', ObjectTypeListAPIView.as_view(), name='object-types'),
    path('worker/taxpayer/<int:taxpayer_id>/objects/', CreateObjectAPIView.as_view(), name='create-object'),
    path('worker/objects/<int:object_id>/', ObjectDetailAPIView.as_view(), name='object-detail'),

    path('worker/tax-regimes/', TaxRegimeListAPIView.as_view(), name='tax-regimes'),
    path('worker/payer-statuses/', PayerStatusListAPIView.as_view(), name='payer-statuses'),

    # Декларации для сотрудников
    path('worker/declarations-for-review/', WorkerDeclarationsForReviewAPIView.as_view(), name='worker-declarations-for-review'),
    path('worker/declarations/<int:declaration_id>/', WorkerDeclarationDetailAPIView.as_view(), name='worker-declaration-detail'),
    path('worker/declarations/<int:declaration_id>/update/', WorkerDeclarationUpdateAPIView.as_view(), name='worker-declaration-update'),

    # Проверки для сотрудников
    path('worker/inspections/', WorkerInspectionsListAPIView.as_view(), name='worker-inspections-list'),
    path('worker/inspections/<int:inspection_id>/', WorkerInspectionDetailAPIView.as_view(), name='worker-inspection-detail'),
    path('worker/inspections/create/', WorkerInspectionCreateAPIView.as_view(), name='worker-inspection-create'),
    path('worker/inspections/<int:inspection_id>/update/', WorkerInspectionUpdateAPIView.as_view(), name='worker-inspection-update'),

    path('worker/generate-inn/', GenerateINNView.as_view(), name='generate-inn'),
    path('worker/create-taxpayer/', CreateTaxpayerAPIView.as_view(), name='create-taxpayer'),

    path('worker/reset-taxpayer-password/', ResetTaxpayerPasswordAPIView.as_view(), name='reset-taxpayer-password'),
]