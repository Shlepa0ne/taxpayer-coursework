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
]