from django.urls import path
from .views import TaxpayerListAPIView, TaxpayerDetailAPIView, CalculateRiskScoreAPIView

urlpatterns = [
    path('taxpayers/', TaxpayerListAPIView.as_view(), name='taxpayer-list'),
    path('taxpayers/<int:pk>/', TaxpayerDetailAPIView.as_view(), name='taxpayer-detail'),
    path('calculate-risk-score/', CalculateRiskScoreAPIView.as_view(), name='calculate-risk-score'),
]