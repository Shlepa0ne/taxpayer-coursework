from django.urls import path
from .views import (
    TaxpayerListAPIView,
    TaxpayerDetailAPIView,
    CalculateRiskScoreAPIView,
    MyTaxAccrualsAPIView,
    CreateTaxReduceRequestAPIView,
    ReduceBaseListAPIView,
    TaxpayerLoginAPIView, 
    WorkerLoginAPIView,
    CustomTokenRefreshView,
    CurrentTaxpayerAPIView,
    LatestRiskScoreAPIView,
    ProfileDetailAPIView, 
    ChangePasswordAPIView
)

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
]