from rest_framework import generics, status, serializers, permissions
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection, transaction
from django.utils import timezone
from .models import *
from .serializers import *
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from .authentication import InnAuthentication
from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Sum
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from io import BytesIO
from django.http import HttpResponse
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

class TaxpayerListAPIView(generics.ListAPIView):
    queryset = Taxpayer.objects.all()
    serializer_class = TaxpayerSerializer
    permission_classes = [IsAuthenticated]

class TaxpayerDetailAPIView(generics.RetrieveAPIView):
    queryset = Taxpayer.objects.all()
    serializer_class = TaxpayerSerializer
    permission_classes = [IsAuthenticated]

class CalculateRiskScoreAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, *args, **kwargs):
        input_serializer = RiskScoreInputSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        taxpayer_id = input_serializer.validated_data['taxpayer_id']
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT calculate_risk_score(%s)", [taxpayer_id])
                result = cursor.fetchone()
            if result is None:
                return Response({"error": "Функция не вернула результат."}, status=status.HTTP_404_NOT_FOUND)
            risk_score_value = result[0]
            output_serializer = RiskScoreOutputSerializer(data={'risk_score': risk_score_value})
            output_serializer.is_valid(raise_exception=True)
            return Response(output_serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Ошибка выполнения запроса: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MyTaxAccrualsAPIView(generics.ListAPIView):
    serializer_class = TaxAccrualSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]  # Добавьте эту строку
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxAccrual.objects.filter(taxpayer__inn=user_inn)

# Добавьте authentication_classes ко всем защищенным View
class ReduceBaseListAPIView(generics.ListAPIView):
    queryset = ReduceBase.objects.all()
    serializer_class = ReduceBaseSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]  # Добавьте

class CreateTaxReduceRequestAPIView(generics.CreateAPIView):
    serializer_class = TaxReduceRequestSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def create(self, request, *args, **kwargs):
        # Получаем данные из запроса
        tax_types_data = request.data.get('tax_types', [])
        periods_data = request.data.get('periods', [])
        
        # Создаем копию данных для сериализатора
        serializer_data = request.data.copy()
        
        # Валидируем основными данными
        serializer = self.get_serializer(data=serializer_data)
        serializer.is_valid(raise_exception=True)
        
        try:
            with transaction.atomic():
                user = self.request.user
                taxpayer = Taxpayer.objects.get(inn=user.username)
                default_status = ReportStatus.objects.get(pk=1)
                default_tax_officer = TaxOfficer.objects.get(pk=1)
                reduce_type = ReduceType.objects.get(pk=request.data.get('reduce_type', 1))
                
                # Создаем заявление
                tax_reduce_request = TaxReduceRequest.objects.create(
                    taxpayer=taxpayer,
                    send_date=timezone.now(),
                    request_status=default_status,
                    tax_officer=default_tax_officer,
                    reduce_type=reduce_type,
                    requested_reduce_amount=serializer.validated_data['requested_reduce_amount'],
                    full_description=serializer.validated_data['full_description'],
                    reduce_base=serializer.validated_data['reduce_base']
                )
                
                # Создаем связи с типами налогов
                for tax_type_id in tax_types_data:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "INSERT INTO tax_reduce_request_tax_type (request_id, tax_type_id) VALUES (%s, %s)",
                            [tax_reduce_request.request_id, tax_type_id]
                        )
                
                # Создаем периоды и связи
                for period_data in periods_data:
                    start_date = period_data.get('start_date')
                    end_date = period_data.get('end_date')
                    
                    if start_date and end_date:
                        # Находим или создаем период
                        period = self.get_or_create_period(start_date, end_date)
                        
                        # Создаем связь с заявлением
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "INSERT INTO rax_period_tax_reduce_request (period_id, request_id) VALUES (%s, %s)",
                                [period.period_id, tax_reduce_request.request_id]
                            )
                
                # Сериализуем ответ
                response_serializer = TaxReduceRequestSerializer(tax_reduce_request)
                headers = self.get_success_headers(response_serializer.data)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
                
        except (Taxpayer.DoesNotExist, ReportStatus.DoesNotExist, 
                TaxOfficer.DoesNotExist, ReduceType.DoesNotExist) as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании заявления: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_or_create_period(self, start_date, end_date):
        """Находит или создает период в таблице tax_period"""
        try:
            # Преобразуем строки в даты
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            # Пытаемся найти существующий период
            period = TaxPeriod.objects.filter(
                start_date=start_date,
                end_date=end_date
            ).first()
            
            if period:
                return period
            
            # Определяем тип периода
            period_type_id = self.determine_period_type(start_date, end_date)
            
            # Создаем новый период
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=period_type_id
            )
            
            return period
            
        except Exception as e:
            # В случае ошибки создаем период с квартальным типом по умолчанию
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=2  # квартальный по умолчанию
            )
            return period
    
    def determine_period_type(self, start_date, end_date):
        """Определяет тип периода на основе дат"""
        from datetime import timedelta
        
        # Проверяем годовой период (с 1 января по 31 декабря)
        if (start_date.month == 1 and start_date.day == 1 and 
            end_date.month == 12 and end_date.day == 31):
            return 1  # годовой
        
        # Проверяем квартальные периоды
        quarters = [
            (1, 1, 31, 3),   # Q1: 1 янв - 31 мар
            (1, 4, 30, 6),   # Q2: 1 апр - 30 июн
            (1, 7, 30, 9),   # Q3: 1 июл - 30 сен
            (1, 10, 31, 12)  # Q4: 1 окт - 31 дек
        ]
        
        for quarter_start_day, quarter_start_month, quarter_end_day, quarter_end_month in quarters:
            if (start_date.month == quarter_start_month and start_date.day == quarter_start_day and
                end_date.month == quarter_end_month and end_date.day == quarter_end_day):
                return 2  # квартальный
        
        # Проверяем месячный период (разница в днях примерно 27-31 день)
        days_diff = (end_date - start_date).days
        if 27 <= days_diff <= 31:
            return 3  # месячный
        
        # По умолчанию считаем квартальным
        return 2
        

def _make_tokens_for_inn(inn: str, user_type: str):
    """
    Возвращает словарь с refresh и access токенами (строки).
    Мы не привязываем токен к Django User — добавляем нужные claim'ы.
    """
    refresh = RefreshToken()  # создаёт новый RefreshToken
    # кастомные claims:
    refresh['inn'] = inn
    refresh['user_type'] = user_type
    # access — вложенный токен:
    access = refresh.access_token
    return {
        'refresh': str(refresh),
        'access': str(access)
    }


class TaxpayerLoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inn = serializer.validated_data['inn']
        password = serializer.validated_data['password']

        try:
            cred = TaxpayerAuth.objects.get(pk=inn)
        except TaxpayerAuth.DoesNotExist:
            return Response({'detail': 'Такой пользователь не найден'}, status=status.HTTP_401_UNAUTHORIZED)

        if not check_password(password, cred.password_hash):
            return Response({'detail': 'Неверный ИНН или пароль'}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = _make_tokens_for_inn(inn, 'taxpayer')
        return Response({
                "refresh": tokens["refresh"],
                "access": tokens["access"],
                "role": "taxpayer"
            }, status=status.HTTP_200_OK)


def _make_tokens_for_worker(inn: str, role_id: int):
    """
    Создает токены для сотрудника с role_id в payload
    """
    refresh = RefreshToken()
    
    # Добавляем кастомные claims в refresh токен
    refresh['inn'] = inn
    refresh['user_type'] = 'worker'
    refresh['role_id'] = role_id
    
    # Создаем access токен из refresh
    access = refresh.access_token
    
    # Добавляем те же claims в access токен
    access['inn'] = inn
    access['user_type'] = 'worker'
    access['role_id'] = role_id
    
    return {
        'refresh': str(refresh),
        'access': str(access)
    }

class WorkerLoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inn = serializer.validated_data['inn']
        password = serializer.validated_data['password']

        try:
            cred = WorkerAuth.objects.get(pk=inn)
        except WorkerAuth.DoesNotExist:
            return Response({'detail': 'Такой сотрудник не найден'}, status=status.HTTP_401_UNAUTHORIZED)

        if not check_password(password, cred.password_hash):
            return Response({'detail': 'Неверный ИНН или пароль'}, status=status.HTTP_401_UNAUTHORIZED)

        # Получаем role_id из связанного tax_officer
        role_id = 1  # по умолчанию обычный инспектор
        if cred.tax_officer:
            role_id = cred.tax_officer.role_id

        # ИСПРАВЛЕНИЕ: используем новую функцию с role_id
        tokens = _make_tokens_for_worker(inn, role_id)
        
        return Response({
                "refresh": tokens["refresh"],
                "access": tokens["access"],
                "role": "worker",
                "role_id": role_id
            }, status=status.HTTP_200_OK)
    

class CustomTokenRefreshView(TokenRefreshView):
    """
    Refresh, который возвращает access/refresh с inn, user_type и role_id.
    """
    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response({"detail": "Refresh token отсутствует"}, status=400)

        try:
            refresh = RefreshToken(refresh_token)
        except Exception:
            return Response({"detail": "Неверный refresh токен"}, status=400)

        # старые claim'ы берём из refresh токена:
        inn = refresh.get("inn")
        user_type = refresh.get("user_type")
        role_id = refresh.get("role_id", 1)  # Добавляем получение role_id

        if not inn or not user_type:
            return Response({"detail": "Refresh токен не содержит данные пользователя"}, status=400)

        # Для сотрудников дополнительно проверяем role_id из базы
        if user_type == 'worker' and not role_id:
            try:
                worker_auth = WorkerAuth.objects.get(inn=inn)
                if worker_auth.tax_officer:
                    role_id = worker_auth.tax_officer.role_id
            except WorkerAuth.DoesNotExist:
                role_id = 1

        # генерируем новый refresh с ВСЕМИ claim'ами
        new_refresh = RefreshToken()
        new_refresh["inn"] = inn
        new_refresh["user_type"] = user_type
        new_refresh["role_id"] = role_id  # Сохраняем role_id

        # новый access с ВСЕМИ claim'ами
        access = new_refresh.access_token
        access["inn"] = inn
        access["user_type"] = user_type
        access["role_id"] = role_id  # Сохраняем role_id

        response_data = {
            "refresh": str(new_refresh),
            "access": str(access),
            "inn": inn,
            "user_type": user_type,
            "role_id": role_id  # Всегда возвращаем role_id
        }

        return Response(response_data)
    
class CurrentTaxpayerAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            return Response({
                'taxpayer_id': taxpayer.taxpayer_id,
                'inn': taxpayer.inn,
                'fio': taxpayer.fio,
                'full_name': taxpayer.full_name,
                'short_name': taxpayer.short_name,
                'payer_type_id': taxpayer.payer_type_id
            })
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)

class LatestRiskScoreAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            # Находим налогоплательщика
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            # Получаем последний RiskScore из таблицы taxpayer_rating
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT rating_value, rating_date 
                    FROM taxpayer_rating 
                    WHERE taxpayer_id = %s 
                    ORDER BY rating_date DESC, rating_id DESC 
                    LIMIT 1
                """, [taxpayer.taxpayer_id])
                result = cursor.fetchone()
                
            if result and result[0] is not None:
                risk_score_value = int(result[0]) if result[0] else 0
                return Response({'risk_score': risk_score_value})
            else:
                # Если нет записи, рассчитываем текущий RiskScore
                with connection.cursor() as cursor:
                    cursor.execute("SELECT calculate_risk_score(%s)", [taxpayer.taxpayer_id])
                    result = cursor.fetchone()
                    if result and result[0] is not None:
                        risk_score_value = int(result[0]) if result[0] else 0
                        return Response({'risk_score': risk_score_value})
                
                return Response({'risk_score': 0})
                
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)
        
class RiskScoreHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT rating_id, rating_value, rating_date 
                    FROM taxpayer_rating 
                    WHERE taxpayer_id = %s 
                    ORDER BY rating_date DESC, rating_id DESC
                """, [taxpayer.taxpayer_id])
                results = cursor.fetchall()
                
            history = []
            for row in results:
                history.append({
                    'rating_id': row[0],
                    'risk_score': int(row[1]) if row[1] is not None else 0,
                    'rating_date': row[2]
                })
            
            return Response({'history': history})
            
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)

class ProfileDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            serializer = ProfileSerializer(taxpayer)
            return Response(serializer.data)
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)

class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        user = request.user
        serializer = ChangePasswordSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        current_password = serializer.validated_data['current_password']
        new_password = serializer.validated_data['new_password']
        
        try:
            # Проверяем, является ли пользователь налогоплательщиком
            if user.user_type == 'taxpayer':
                auth_record = TaxpayerAuth.objects.get(inn=user.inn)
            elif user.user_type == 'worker':
                auth_record = WorkerAuth.objects.get(inn=user.inn)
            else:
                return Response({'error': 'Неизвестный тип пользователя'}, status=400)
            
            # Проверяем текущий пароль
            if not check_password(current_password, auth_record.password_hash):
                return Response(
                    {'error': 'Текущий пароль неверен'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Обновляем пароль
            auth_record.password_hash = make_password(new_password)
            auth_record.save()
            
            return Response({'message': 'Пароль успешно изменен'})
            
        except (TaxpayerAuth.DoesNotExist, WorkerAuth.DoesNotExist):
            return Response({'error': 'Пользователь не найден'}, status=404)
        
class MyTaxReduceRequestsAPIView(generics.ListAPIView):
    serializer_class = TaxReduceRequestListSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxReduceRequest.objects.filter(
            taxpayer__inn=user_inn
        ).order_by('-send_date')
    
class MyTaxableObjectsAPIView(generics.ListAPIView):
    serializer_class = ObjectOwnershipSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return ObjectOwnership.objects.filter(
            taxpayer__inn=user_inn
        ).select_related('object', 'object__object_type', 'object__real_estate_type')
    
class MyTaxAccrualsWithPaymentsAPIView(generics.ListAPIView):
    serializer_class = TaxAccrualWithPaymentSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxAccrual.objects.filter(taxpayer__inn=user_inn)

class CreateTaxPaymentAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                user_inn = request.user.username
                tax_accrual_id = serializer.validated_data['tax_accrual_id']
                payment_amount = serializer.validated_data['payment_amount']
                
                # Проверяем, что начисление принадлежит пользователю
                accrual = TaxAccrual.objects.get(
                    tax_accrual_id=tax_accrual_id,
                    taxpayer__inn=user_inn
                )
                
                # Получаем уже оплаченную сумму
                paid_amount = TaxPayment.objects.filter(
                    tax_income_id=tax_accrual_id
                ).aggregate(total=Sum('payment_amount'))['total'] or 0
                
                remaining_amount = accrual.accrual_amount - paid_amount
                
                # Проверяем, что сумма оплаты не превышает оставшуюся
                if payment_amount > remaining_amount:
                    return Response(
                        {'error': f'Сумма оплаты не может превышать {remaining_amount} руб.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if payment_amount <= 0:
                    return Response(
                        {'error': 'Сумма оплаты должна быть положительной'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Создаем платеж
                payment = TaxPayment.objects.create(
                    payment_date=timezone.now(),
                    payment_amount=payment_amount,
                    tax_income=accrual,
                    kbk_id=1,  # Значение по умолчанию
                    debit_account='',
                    credit_account=''
                )
                
                # Обновляем статус начисления после платежа
                self._update_accrual_status(accrual)
                
                return Response({
                    'message': 'Платеж успешно создан',
                    'payment_id': payment.payment_id,
                    'payment_amount': payment.payment_amount
                }, status=status.HTTP_201_CREATED)
                
        except TaxAccrual.DoesNotExist:
            return Response(
                {'error': 'Начисление не найдено или не принадлежит пользователю'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании платежа: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _update_accrual_status(self, accrual):
        """Обновляет статус начисления на основе оплаченной суммы"""
        try:
            # Получаем текущую сумму всех платежей по этому начислению
            total_paid = TaxPayment.objects.filter(
                tax_income=accrual
            ).aggregate(total=Sum('payment_amount'))['total'] or 0
            
            # Определяем новый статус
            if total_paid >= accrual.accrual_amount:
                # Полностью оплачено
                new_status_id = 3
            elif total_paid > 0:
                # Частично оплачено
                new_status_id = 2
            else:
                # Не оплачено, проверяем просрочку
                if accrual.due_date and timezone.now().date() > accrual.due_date:
                    new_status_id = 4  # Просрочено
                else:
                    new_status_id = 1  # Начислено
            
            # Обновляем статус начисления
            accrual.accrual_status_id = new_status_id
            accrual.save()
            
        except Exception as e:
            # Логируем ошибку, но не прерываем выполнение
            print(f"Ошибка при обновлении статуса начисления: {str(e)}")

class MyTaxAccrualsWithPaymentsAPIView(generics.ListAPIView):
    serializer_class = TaxAccrualWithPaymentSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        
        try:
            current_taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            # Получаем начисления, где пользователь является налогоплательщиком
            taxpayer_accruals = TaxAccrual.objects.filter(taxpayer__inn=user_inn)
            
            # Получаем начисления от деклараций 6-НДФЛ, которые пользователь подал за других
            # Используем exclude вместо __ne
            declarant_accruals = TaxAccrual.objects.filter(
                declaration__who_declares=current_taxpayer
            ).exclude(declaration__taxpayer__inn=user_inn)  # Исключаем свои же 3-НДФЛ
            
            # Объединяем два QuerySet
            all_accruals = (taxpayer_accruals | declarant_accruals).distinct()
            
            return all_accruals.select_related(
                'object', 
                'object__object_type',
                'declaration',
                'declaration__taxpayer',
                'declaration__who_declares'
            ).order_by('-accrual_date')
            
        except Taxpayer.DoesNotExist:
            return TaxAccrual.objects.none()
        
class MyDeclarationsAPIView(generics.ListAPIView):
    serializer_class = DeclarationListSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        try:
            user = self.request.user
            user_inn = user.username
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            return Declaration.objects.filter(
                who_declares=taxpayer
            ).select_related('tax_type', 'taxpayer', 'period').order_by('-submission_date')
            
        except Taxpayer.DoesNotExist:
            return Declaration.objects.none()
        except Exception as e:
            return Declaration.objects.none()
        
class CreateDeclarationAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        serializer = DeclarationSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = self.request.user
            current_taxpayer = Taxpayer.objects.get(inn=user.username)
            
            declaration_type = serializer.validated_data.get('declaration_type')
            target_inn = serializer.validated_data.get('target_inn', '')
            tax_type = serializer.validated_data.get('tax_type')
            tax_sum = serializer.validated_data.get('tax_sum')
            total_income = serializer.validated_data.get('total_income')
            period_start = serializer.validated_data.get('period_start')
            period_end = serializer.validated_data.get('period_end')
            
            # Определяем taxpayer_id в зависимости от типа декларации
            if declaration_type == '3-NDFL':
                taxpayer = current_taxpayer
                who_declares = current_taxpayer
            elif declaration_type == '6-NDFL':
                if not target_inn:
                    return Response(
                        {'error': 'Для 6-НДФЛ необходимо указать ИНН налогоплательщика'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    taxpayer = Taxpayer.objects.get(inn=target_inn)
                except Taxpayer.DoesNotExist:
                    return Response(
                        {'error': 'Налогоплательщик с указанным ИНН не найден'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                who_declares = current_taxpayer
            else:
                return Response(
                    {'error': 'Неверный тип декларации'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Находим или создаем период
            period = self.get_or_create_period(period_start, period_end)
            
            # Создаем декларацию
            declaration = Declaration.objects.create(
                taxpayer=taxpayer,
                who_declares=who_declares,
                tax_type=tax_type,
                tax_sum=tax_sum,
                total_income=total_income,
                submission_date=timezone.now(),
                period=period,
                declaration_status_id=2  # Статус "Подана"
            )
            
            response_serializer = DeclarationSerializer(declaration)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except Taxpayer.DoesNotExist:
            return Response(
                {'error': 'Текущий налогоплательщик не найден'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании декларации: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_or_create_period(self, start_date, end_date):
        """Находит или создает период в таблице tax_period"""
        try:
            # Пытаемся найти существующий период
            period = TaxPeriod.objects.filter(
                start_date=start_date,
                end_date=end_date
            ).first()
            
            if period:
                return period
            
            # Определяем тип периода
            period_type_id = self.determine_period_type(start_date, end_date)
            
            # Создаем новый период
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=period_type_id
            )
            
            return period
            
        except Exception as e:
            # В случае ошибки создаем период с квартальным типом по умолчанию
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=2  # квартальный по умолчанию
            )
            return period
    
    def determine_period_type(self, start_date, end_date):
        """Определяет тип периода на основе дат"""
        from datetime import timedelta
        
        # Проверяем годовой период (с 1 января по 31 декабря)
        if (start_date.month == 1 and start_date.day == 1 and 
            end_date.month == 12 and end_date.day == 31):
            return 1  # годовой
        
        # Проверяем квартальные периоды
        quarters = [
            (1, 1, 31, 3),   # Q1: 1 янв - 31 мар
            (1, 4, 30, 6),   # Q2: 1 апр - 30 июн
            (1, 7, 30, 9),   # Q3: 1 июл - 30 сен
            (1, 10, 31, 12)  # Q4: 1 окт - 31 дек
        ]
        
        for quarter_start_day, quarter_start_month, quarter_end_day, quarter_end_month in quarters:
            if (start_date.month == quarter_start_month and start_date.day == quarter_start_day and
                end_date.month == quarter_end_month and end_date.day == quarter_end_day):
                return 2  # квартальный
        
        # Проверяем месячный период (разница в днях примерно 27-31 день)
        days_diff = (end_date - start_date).days
        if 27 <= days_diff <= 31:
            return 3  # месячный
        
        # По умолчанию считаем квартальным
        return 2
        
class TaxTypeListAPIView(generics.ListAPIView):
    queryset = TaxType.objects.all()
    serializer_class = TaxTypeSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

class CurrentWorkerAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            if worker_auth.tax_officer:
                tax_officer = worker_auth.tax_officer
                
                return Response({
                    'tax_officer_id': tax_officer.tax_officer_id,
                    'tax_officer_name': tax_officer.tax_officer_name,
                    'unit': tax_officer.unit or 'Не указано',
                    'role_id': tax_officer.role_id or 1,
                    'can_review_requests': tax_officer.role_id in [2, 3]  # Старший инспектор (2) или руководитель (3)
                })
            else:
                return Response({
                    'error': 'Профиль сотрудника не найден'
                }, status=404)
                
        except WorkerAuth.DoesNotExist:
            return Response({'error': 'Сотрудник не найден'}, status=404)

class AverageRiskScoreAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT AVG(latest_ratings.rating_value) 
                    FROM (
                        SELECT DISTINCT ON (taxpayer_id) rating_value
                        FROM taxpayer_rating 
                        ORDER BY taxpayer_id, rating_date DESC, rating_id DESC
                    ) AS latest_ratings
                    WHERE latest_ratings.rating_value IS NOT NULL
                """)
                result = cursor.fetchone()
                
            average_score = result[0] if result and result[0] is not None else 0
            return Response({'average_score': round(average_score, 2)})
            
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)


class PendingRequestsCountAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            count = TaxReduceRequest.objects.filter(
                request_status_id=1  # Статус "на рассмотрении"
            ).count()
            return Response({'count': count})
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)

class DeclarationsCountAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            count = Declaration.objects.filter(
                declaration_status_id=2  # Статус "подана"
            ).count()
            return Response({'count': count})
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)

class UpcomingInspectionsCountAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            user_inn = request.user.username
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            # Используем ForeignKey связь через tax_officer
            if worker_auth.tax_officer:
                tax_officer_id = worker_auth.tax_officer.tax_officer_id
                
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT COUNT(*) 
                        FROM inspection i
                        INNER JOIN tax_officer_inspection toi ON i.inspection_id = toi.inspection_id
                        WHERE toi.tax_officer_id = %s 
                        AND i.inspection_date >= CURRENT_DATE
                        AND i.inspection_type_status_id = 1  -- Статус "запланирована"
                    """, [tax_officer_id])
                    result = cursor.fetchone()
                    
                count = result[0] if result else 0
                return Response({'count': count})
            else:
                # Если у сотрудника нет связанного tax_officer, возвращаем 0
                return Response({'count': 0})
                
        except WorkerAuth.DoesNotExist:
            return Response({'count': 0})
        except Exception as e:
            print(f"Error in upcoming inspections: {e}")
            # В случае любой ошибки возвращаем 0
            return Response({'count': 0})
        

# Добавьте в views.py

class TaxpayerSearchAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        search_type = request.query_params.get('type', 'simple')
        query = request.query_params.get('query', '')
        
        if search_type == 'simple':
            return self.simple_search(query)
        elif search_type == 'advanced':
            return self.advanced_search(request.query_params)
        else:
            return Response({'error': 'Неверный тип поиска'}, status=400)

    def simple_search(self, query):
        if not query:
            return Response({'error': 'Пустой запрос'}, status=400)
        
        try:
            # Поиск по всем основным полям
            taxpayers = Taxpayer.objects.filter(
                models.Q(inn__icontains=query) |
                models.Q(fio__icontains=query) |
                models.Q(full_name__icontains=query) |
                models.Q(short_name__icontains=query) |
                models.Q(registration_address__icontains=query) |
                models.Q(fact_address__icontains=query) |
                models.Q(ogrn__icontains=query)
            )[:100]  # Ограничиваем результаты
            
            serializer = TaxpayerSearchSerializer(taxpayers, many=True)
            return Response({'results': serializer.data})
            
        except Exception as e:
            return Response({'error': f'Ошибка поиска: {str(e)}'}, status=500)

    def advanced_search(self, params):
        try:
            queryset = Taxpayer.objects.all()
            
            # Фильтрация по ИНН
            if params.get('inn'):
                queryset = queryset.filter(inn__icontains=params['inn'])
            
            # Фильтрация по ФИО (для физлиц)
            if params.get('fio'):
                queryset = queryset.filter(fio__icontains=params['fio'])
            
            # Фильтрация по названию организации
            if params.get('org_name'):
                queryset = queryset.filter(
                    models.Q(full_name__icontains=params['org_name']) |
                    models.Q(short_name__icontains=params['org_name'])
                )
            
            # Фильтрация по региону
            if params.get('region_id'):
                queryset = queryset.filter(region_key=params['region_id'])
            
            # Фильтрация по типу налогоплательщика
            if params.get('payer_type_id'):
                queryset = queryset.filter(payer_type_id=params['payer_type_id'])
            
            # Фильтрация по налоговому режиму
            if params.get('tax_regime_id'):
                queryset = queryset.filter(tax_regime_id=params['tax_regime_id'])
            
            # Фильтрация по адресу
            if params.get('address'):
                queryset = queryset.filter(
                    models.Q(registration_address__icontains=params['address']) |
                    models.Q(fact_address__icontains=params['address'])
                )
            
            taxpayers = queryset[:100]  # Ограничиваем результаты
            serializer = TaxpayerSearchSerializer(taxpayers, many=True)
            return Response({'results': serializer.data})
            
        except Exception as e:
            return Response({'error': f'Ошибка расширенного поиска: {str(e)}'}, status=500)

class TaxpayerDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request, taxpayer_id):
        try:
            taxpayer = Taxpayer.objects.get(taxpayer_id=taxpayer_id)
            serializer = TaxpayerDetailSerializer(taxpayer)
            return Response(serializer.data)
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка загрузки данных: {str(e)}'}, status=500)

class RegionListAPIView(generics.ListAPIView):
    queryset = Region.objects.all()
    serializer_class = serializers.SerializerMethodField()
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def list(self, request):
        try:
            regions = Region.objects.all()
            data = [{'region_id': r.region_id, 'name': r.name, 'code': r.code} for r in regions]
            return Response(data)
        except Exception as e:
            return Response({'error': f'Ошибка загрузки регионов: {str(e)}'}, status=500)
        
class WorkerRequestsForReviewAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    serializer_class = TaxReduceRequestDetailSerializer
    
    def get_queryset(self):
        # Заявления со статусом "на рассмотрении" (1), отсортированные по дате
        queryset = TaxReduceRequest.objects.filter(
            request_status_id=1
        ).select_related(
            'taxpayer', 'reduce_base', 'request_status', 'reduce_type'
        ).order_by('-send_date')
        
        return queryset

class WorkerRequestDetailAPIView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    queryset = TaxReduceRequest.objects.all()
    serializer_class = TaxReduceRequestDetailSerializer
    
    def get_queryset(self):
        return TaxReduceRequest.objects.select_related(
            'taxpayer', 'reduce_base', 'request_status', 'reduce_type'
        )

class WorkerRequestUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, request_id):
        try:
            tax_reduce_request = TaxReduceRequest.objects.get(request_id=request_id)
            new_status = request.data.get('request_status_id')
            verdict_comment = request.data.get('verdict_comment', '')
            
            # Разрешаем статусы: 1 (возврат на рассмотрение), 2 (одобрено), 3 (отклонено)
            if new_status not in [1, 2, 3]:
                return Response(
                    {'error': 'Неверный статус. Допустимые значения: 1 (на рассмотрении), 2 (одобрено), 3 (отклонено)'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Обновляем заявление
            tax_reduce_request.request_status_id = new_status
            tax_reduce_request.verdict_date = timezone.now()
            tax_reduce_request.verdict_comment = verdict_comment
            
            # Получаем текущего сотрудника
            user_inn = request.user.username
            try:
                worker_auth = WorkerAuth.objects.get(inn=user_inn)
                if worker_auth.tax_officer:
                    tax_reduce_request.tax_officer = worker_auth.tax_officer
            except WorkerAuth.DoesNotExist:
                pass
            
            tax_reduce_request.save()
            
            serializer = TaxReduceRequestDetailSerializer(tax_reduce_request)
            return Response(serializer.data)
            
        except TaxReduceRequest.DoesNotExist:
            return Response(
                {'error': 'Заявление не найдено'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Ошибка при обновлении заявления: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class UpdateTaxpayerInfoAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, taxpayer_id):
        try:
            taxpayer = Taxpayer.objects.get(taxpayer_id=taxpayer_id)
            
            # Создаем копию данных
            update_data = request.data.copy()
            
            # Для физических лиц удаляем поля, которые им не положены
            if taxpayer.payer_type_id == 1:  # Физическое лицо
                update_data.pop('ogrn', None)
                update_data.pop('full_name', None)
                update_data.pop('short_name', None)
                update_data.pop('executive_list', None)
            
            # Для ИП и Юрлиц удаляем ФИО
            elif taxpayer.payer_type_id in [2, 3]:  # ИП или Юрлицо
                update_data.pop('fio', None)
            
            serializer = TaxpayerUpdateSerializer(taxpayer, data=update_data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Ошибка при обновлении: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DocumentTypeListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    queryset = DocumentType.objects.all()
    
    def list(self, request):
        document_types = self.get_queryset()
        data = [{'document_type_id': dt.document_type_id, 'name': dt.name} for dt in document_types]
        return Response(data)

class CreateDocumentAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request, taxpayer_id):
        try:
            taxpayer = Taxpayer.objects.get(taxpayer_id=taxpayer_id)
            serializer = DocumentCreateSerializer(data=request.data)
            
            if serializer.is_valid():
                document = serializer.save(taxpayer=taxpayer)
                return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=status.HTTP_404_NOT_FOUND)

class DocumentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, document_id):
        try:
            document = Document.objects.get(document_id=document_id)
            serializer = DocumentUpdateSerializer(document, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response(DocumentSerializer(document).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Document.DoesNotExist:
            return Response({'error': 'Документ не найден'}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, document_id):
        try:
            document = Document.objects.get(document_id=document_id)
            document.delete()
            return Response({'message': 'Документ удален'}, status=status.HTTP_204_NO_CONTENT)
            
        except Document.DoesNotExist:
            return Response({'error': 'Документ не найден'}, status=status.HTTP_404_NOT_FOUND)

class ContactTypeListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    queryset = ContactType.objects.all()
    
    def list(self, request):
        contact_types = self.get_queryset()
        data = [{'contact_type_id': ct.type_id, 'name': ct.name} for ct in contact_types]
        return Response(data)

class CreateContactAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request, taxpayer_id):
        try:
            taxpayer = Taxpayer.objects.get(taxpayer_id=taxpayer_id)
            serializer = ContactCreateSerializer(data=request.data)
            
            if serializer.is_valid():
                contact = serializer.save(taxpayer=taxpayer)
                return Response(ContactDataSerializer(contact).data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=status.HTTP_404_NOT_FOUND)

class ContactDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, contact_id):
        try:
            contact = ContactData.objects.get(contact_id=contact_id)
            serializer = ContactUpdateSerializer(contact, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response(ContactDataSerializer(contact).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except ContactData.DoesNotExist:
            return Response({'error': 'Контакт не найден'}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, contact_id):
        try:
            contact = ContactData.objects.get(contact_id=contact_id)
            contact.delete()
            return Response({'message': 'Контакт удален'}, status=status.HTTP_204_NO_CONTENT)
            
        except ContactData.DoesNotExist:
            return Response({'error': 'Контакт не найден'}, status=status.HTTP_404_NOT_FOUND)

class ObjectTypeListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    queryset = ObjectType.objects.all()
    
    def list(self, request):
        object_types = self.get_queryset()
        data = [{'object_type_id': ot.object_type_id, 'object_type_name': ot.object_type_name} for ot in object_types]
        return Response(data)

class CreateObjectAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request, taxpayer_id):
        try:
            with transaction.atomic():
                taxpayer = Taxpayer.objects.get(taxpayer_id=taxpayer_id)
                object_serializer = ObjectCreateSerializer(data=request.data)
                
                if object_serializer.is_valid():
                    taxable_object = object_serializer.save()
                    
                    # Создаем запись о владении
                    ownership_data = {
                        'taxpayer': taxpayer.taxpayer_id,
                        'object': taxable_object.object_id,
                        'ownership_start_date': request.data.get('ownership_start_date'),
                        'ownership_end_date': request.data.get('ownership_end_date') or None
                    }
                    
                    ownership_serializer = ObjectOwnershipCreateSerializer(data=ownership_data)
                    if ownership_serializer.is_valid():
                        ownership_serializer.save()
                        return Response(
                            TaxableObjectSerializer(taxable_object).data, 
                            status=status.HTTP_201_CREATED
                        )
                    else:
                        taxable_object.delete()
                        return Response(ownership_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
                return Response(object_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ObjectDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, object_id):
        try:
            with transaction.atomic():
                taxable_object = TaxableObject.objects.get(object_id=object_id)
                object_serializer = ObjectUpdateSerializer(taxable_object, data=request.data, partial=True)
                
                if object_serializer.is_valid():
                    object_serializer.save()
                    
                    # Обновляем период владения, если указан
                    ownership_start_date = request.data.get('ownership_start_date')
                    ownership_end_date = request.data.get('ownership_end_date')
                    
                    if ownership_start_date:
                        ownership = ObjectOwnership.objects.filter(
                            object=taxable_object
                        ).first()
                        
                        if ownership:
                            ownership.ownership_start_date = ownership_start_date
                            if ownership_end_date:
                                ownership.ownership_end_date = ownership_end_date
                            ownership.save()
                    
                    return Response(TaxableObjectSerializer(taxable_object).data)
                
                return Response(object_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except TaxableObject.DoesNotExist:
            return Response({'error': 'Объект не найден'}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, object_id):
        try:
            with transaction.atomic():
                taxable_object = TaxableObject.objects.get(object_id=object_id)
                
                # Удаляем связь владения
                ObjectOwnership.objects.filter(object=taxable_object).delete()
                
                # Удаляем сам объект
                taxable_object.delete()
                
                return Response({'message': 'Объект удален'}, status=status.HTTP_204_NO_CONTENT)
                
        except TaxableObject.DoesNotExist:
            return Response({'error': 'Объект не найден'}, status=status.HTTP_404_NOT_FOUND)
        

class TaxRegimeListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def list(self, request):
        try:
            regimes = TaxRegime.objects.all()
            data = [{'regime_id': r.regime_id, 'name': r.name} for r in regimes]
            return Response(data)
        except Exception as e:
            return Response({'error': f'Ошибка загрузки налоговых режимов: {str(e)}'}, status=500)

class PayerStatusListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def list(self, request):
        try:
            # Заглушка для статусов плательщика
            statuses = [
                {'payer_status_id': 1, 'name': 'активный'},
                {'payer_status_id': 2, 'name': 'неактивный'},
                {'payer_status_id': 3, 'name': 'имеет задолженность'}
            ]
            return Response(statuses)
        except Exception as e:
            return Response({'error': f'Ошибка загрузки статусов: {str(e)}'}, status=500)
        
# Добавим в views.py

class WorkerDeclarationsForReviewAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    serializer_class = DeclarationListSerializer
    
    def get_queryset(self):
        # Получаем декларации со статусом "подана" (2), отсортированные по дате
        queryset = Declaration.objects.filter(
            declaration_status_id=2  # Статус "подана"
        ).select_related(
            'tax_type', 'taxpayer', 'period', 'who_declares'
        ).order_by('submission_date')  # Сначала старые
        
        return queryset

class WorkerDeclarationDetailAPIView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    queryset = Declaration.objects.all()
    serializer_class = DeclarationListSerializer
    
    def get_queryset(self):
        return Declaration.objects.select_related(
            'tax_type', 'taxpayer', 'period', 'who_declares'
        )

class WorkerDeclarationUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, declaration_id):
        try:
            print(f"DEBUG: Starting update for declaration {declaration_id}")
            print(f"DEBUG: Request data: {request.data}")
            
            declaration = Declaration.objects.get(declaration_id=declaration_id)
            new_status = request.data.get('declaration_status_id')
            
            print(f"DEBUG: Current status: {declaration.declaration_status_id}, New status: {new_status}")
            
            # Разрешаем статусы: 2 (подана), 3 (принята), 4 (отклонена)
            if new_status not in [2, 3, 4]:
                return Response(
                    {'error': 'Неверный статус. Допустимые значения: 2 (подана), 3 (принята), 4 (отклонена)'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Меняем статус
            declaration.declaration_status_id = new_status
            declaration.save()
            
            print(f"DEBUG: After save - status: {declaration.declaration_status_id}")
            
            # Принудительно обновляем объект из базы
            declaration.refresh_from_db()
            print(f"DEBUG: After refresh - status: {declaration.declaration_status_id}")
            
            # Сериализуем обновленную декларацию
            serializer = DeclarationListSerializer(declaration)
            print(f"DEBUG: Serializer data: {serializer.data}")
            
            return Response(serializer.data)
                
        except Declaration.DoesNotExist:
            print(f"DEBUG: Declaration {declaration_id} not found")
            return Response(
                {'error': 'Декларация не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"DEBUG: Error updating declaration: {str(e)}")
            return Response(
                {'error': f'Ошибка при обновлении декларации: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class WorkerInspectionsListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            if worker_auth.tax_officer:
                tax_officer_id = worker_auth.tax_officer.tax_officer_id
                
                # Получаем проверки, в которых участвует текущий сотрудник
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT DISTINCT i.inspection_id, i.inspection_date, i.inspection_type_id, 
                               i.inspection_reason, i.inspection_type_status_id,
                               t.taxpayer_id, t.inn, t.fio, t.full_name, t.short_name
                        FROM inspection i
                        INNER JOIN tax_officer_inspection toi ON i.inspection_id = toi.inspection_id
                        INNER JOIN taxpayer t ON i.taxpayer_id = t.taxpayer_id
                        WHERE toi.tax_officer_id = %s
                        ORDER BY i.inspection_date DESC
                    """, [tax_officer_id])
                    results = cursor.fetchall()
                
                # Создаем список Inspection объектов
                inspections = []
                for row in results:
                    inspection = {
                        'inspection_id': row[0],
                        'inspection_date': row[1],
                        'inspection_type_id': row[2],
                        'inspection_reason': row[3],
                        'inspection_type_status_id': row[4],
                        'taxpayer': {
                            'taxpayer_id': row[5],
                            'inn': row[6],
                            'fio': row[7],
                            'full_name': row[8],
                            'short_name': row[9]
                        }
                    }
                    inspections.append(inspection)
                
                return Response(inspections)
            else:
                return Response([])
                
        except WorkerAuth.DoesNotExist:
            return Response([])
        except Exception as e:
            print(f"Error in WorkerInspectionsListAPIView: {e}")
            return Response({'error': str(e)}, status=500)

class WorkerInspectionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request, inspection_id):
        try:
            with connection.cursor() as cursor:
                # Получаем основную информацию о проверке
                cursor.execute("""
                    SELECT i.inspection_id, i.inspection_date, i.inspection_type_id, 
                           i.inspection_reason, i.inspection_type_status_id,
                           t.taxpayer_id, t.inn, t.fio, t.full_name, t.short_name,
                           t.registration_address, t.fact_address
                    FROM inspection i
                    INNER JOIN taxpayer t ON i.taxpayer_id = t.taxpayer_id
                    WHERE i.inspection_id = %s
                """, [inspection_id])
                inspection_data = cursor.fetchone()
                
                if not inspection_data:
                    return Response({'error': 'Проверка не найдена'}, status=404)
                
                # Получаем участников проверки
                cursor.execute("""
                    SELECT to2.tax_officer_id, to2.tax_officer_name, to2.unit
                    FROM tax_officer_inspection toi
                    INNER JOIN tax_officer to2 ON toi.tax_officer_id = to2.tax_officer_id
                    WHERE toi.inspection_id = %s
                """, [inspection_id])
                participants_data = cursor.fetchall()
                
                # Получаем нарушения по проверке (ИСПРАВЛЕННЫЙ ЗАПРОС)
                cursor.execute("""
                    SELECT v.violation_id, v.sum_to_pay, v.violation_type_id, v.period_id,
                           vt.violation_name, 
                           CASE 
                               WHEN tp.period_type_id = 1 THEN TO_CHAR(tp.start_date, 'YYYY') || ' год'
                               WHEN tp.period_type_id = 2 THEN 
                                   TO_CHAR(tp.start_date, 'YYYY') || ' Q' || 
                                   EXTRACT(QUARTER FROM tp.start_date)
                               WHEN tp.period_type_id = 3 THEN 
                                   TO_CHAR(tp.start_date, 'TMMonth') || ' ' || TO_CHAR(tp.start_date, 'YYYY')
                               ELSE TO_CHAR(tp.start_date, 'DD.MM.YYYY') || ' - ' || TO_CHAR(tp.end_date, 'DD.MM.YYYY')
                           END as period_name
                    FROM identified_violation v
                    INNER JOIN violation_type vt ON v.violation_type_id = vt.violation_type_id
                    INNER JOIN tax_period tp ON v.period_id = tp.period_id
                    WHERE v.inspection_id = %s
                """, [inspection_id])
                violations_data = cursor.fetchall()
            
            # Формируем ответ
            inspection = {
                'inspection_id': inspection_data[0],
                'inspection_date': inspection_data[1],
                'inspection_type_id': inspection_data[2],
                'inspection_reason': inspection_data[3],
                'inspection_type_status_id': inspection_data[4],
                'taxpayer': {
                    'taxpayer_id': inspection_data[5],
                    'inn': inspection_data[6],
                    'fio': inspection_data[7],
                    'full_name': inspection_data[8],
                    'short_name': inspection_data[9],
                    'registration_address': inspection_data[10],
                    'fact_address': inspection_data[11]
                },
                'participants': [
                    {
                        'tax_officer_id': p[0],
                        'tax_officer_name': p[1],
                        'unit': p[2]
                    } for p in participants_data
                ],
                'violations': [
                    {
                        'violation_id': v[0],
                        'sum_to_pay': float(v[1]) if v[1] else None,
                        'violation_type_id': v[2],
                        'period_id': v[3],
                        'violation_type_name': v[4],
                        'period_name': v[5]
                    } for v in violations_data
                ]
            }
            
            return Response(inspection)
            
        except Exception as e:
            print(f"Error in WorkerInspectionDetailAPIView: {e}")
            return Response({'error': f'Ошибка загрузки данных проверки: {str(e)}'}, status=500)

class WorkerInspectionCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        try:
            user_inn = request.user.username
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            # Проверяем, является ли сотрудник старшим инспектором или выше
            if not worker_auth.tax_officer or worker_auth.tax_officer.role_id < 2:
                return Response(
                    {'error': 'Недостаточно прав для создания проверки'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            with transaction.atomic():
                taxpayer_id = request.data.get('taxpayer_id')
                inspection_date_str = request.data.get('inspection_date')
                inspection_type_id = request.data.get('inspection_type_id', 1)
                inspection_reason_id = request.data.get('inspection_reason_id', 1)
                participants = request.data.get('participants', [])
                
                # Валидация обязательных полей
                if not taxpayer_id:
                    return Response(
                        {'error': 'Не указан налогоплательщик'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if not inspection_date_str:
                    return Response(
                        {'error': 'Не указана дата проверки'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Преобразуем строку даты в объект datetime
                try:
                    # Убираем 'Z' если есть и преобразуем в datetime
                    inspection_date_str = inspection_date_str.replace('Z', '')
                    inspection_date = datetime.fromisoformat(inspection_date_str)
                except ValueError as e:
                    return Response(
                        {'error': f'Неверный формат даты: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Проверяем существование налогоплательщика
                try:
                    taxpayer = Taxpayer.objects.get(taxpayer_id=taxpayer_id)
                except Taxpayer.DoesNotExist:
                    return Response(
                        {'error': 'Налогоплательщик не найден'},
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                # Создаем проверку
                with connection.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO inspection (
                            inspection_date, taxpayer_id, inspection_type_id, 
                            inspection_reason, inspection_type_status_id
                        ) VALUES (%s, %s, %s, %s, 1)
                        RETURNING inspection_id
                    """, [inspection_date, taxpayer_id, inspection_type_id, inspection_reason_id])
                    inspection_id = cursor.fetchone()[0]
                
                # Создаем множество для уникальных участников
                unique_participants = set()
                
                # Добавляем текущего сотрудника как участника
                current_officer_id = worker_auth.tax_officer.tax_officer_id
                unique_participants.add(current_officer_id)
                
                # Добавляем других участников (исключая дубликаты)
                for participant_id in participants:
                    unique_participants.add(int(participant_id))
                
                # Вставляем всех уникальных участников
                for participant_id in unique_participants:
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            INSERT INTO tax_officer_inspection (tax_officer_id, inspection_id)
                            VALUES (%s, %s)
                        """, [participant_id, inspection_id])
                
                return Response({
                    'message': 'Проверка успешно создана',
                    'inspection_id': inspection_id
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании проверки: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class WorkerInspectionUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, inspection_id):
        try:
            user_inn = request.user.username
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            # Проверяем, является ли сотрудник старшим инспектором или выше
            if not worker_auth.tax_officer or worker_auth.tax_officer.role_id < 2:
                return Response(
                    {'error': 'Недостаточно прав для редактирования проверки'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            with connection.cursor() as cursor:
                # Обновляем основную информацию о проверке
                update_fields = []
                params = []
                
                if 'inspection_date' in request.data:
                    update_fields.append("inspection_date = %s")
                    params.append(request.data['inspection_date'])
                
                if 'inspection_type_id' in request.data:
                    update_fields.append("inspection_type_id = %s")
                    params.append(request.data['inspection_type_id'])
                
                if 'inspection_reason' in request.data:
                    update_fields.append("inspection_reason = %s")
                    params.append(request.data['inspection_reason'])
                
                if 'inspection_type_status_id' in request.data:
                    update_fields.append("inspection_type_status_id = %s")
                    params.append(request.data['inspection_type_status_id'])
                
                if update_fields:
                    params.append(inspection_id)
                    cursor.execute(f"""
                        UPDATE inspection 
                        SET {', '.join(update_fields)}
                        WHERE inspection_id = %s
                    """, params)
            
            return Response({'message': 'Проверка успешно обновлена'})
            
        except Exception as e:
            return Response(
                {'error': f'Ошибка при обновлении проверки: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class GenerateINNView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        payer_type_id = request.data.get('payer_type_id')
        tax_office_code = request.data.get('tax_office_code', '7700')  # код по умолчанию
        
        if not payer_type_id:
            return Response({'error': 'Не указан тип плательщика'}, status=400)
        
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT generate_unique_inn(%s, %s)", [payer_type_id, tax_office_code])
                result = cursor.fetchone()
                if result and result[0]:
                    return Response({'inn': result[0]})
                else:
                    return Response({'error': 'Не удалось сгенерировать ИНН'}, status=500)
                    
        except Exception as e:
            return Response({'error': f'Ошибка генерации ИНН: {str(e)}'}, status=500)

class CreateTaxpayerAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        try:
            with transaction.atomic():
                # Получаем данные из запроса
                payer_type_id = request.data.get('payer_type_id')
                inn = request.data.get('inn')
                
                if not payer_type_id or not inn:
                    return Response(
                        {'error': 'Не указан тип плательщика или ИНН'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Проверяем уникальность ИНН
                if Taxpayer.objects.filter(inn=inn).exists():
                    return Response(
                        {'error': 'Налогоплательщик с таким ИНН уже существует'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Проверяем существование региона
                try:
                    region = Region.objects.get(region_id=request.data.get('region_key', 3))
                except Region.DoesNotExist:
                    return Response(
                        {'error': 'Указанный регион не существует'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Проверяем существование налогового режима
                try:
                    tax_regime = TaxRegime.objects.get(regime_id=request.data.get('tax_regime_id', 1))
                except TaxRegime.DoesNotExist:
                    return Response(
                        {'error': 'Указанный налоговый режим не существует'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Базовые данные для налогоплательщика
                taxpayer_data = {
                    'inn': inn,
                    'payer_type_id': payer_type_id,
                    'creation_date': timezone.now(),
                    'update_date': timezone.now(),
                    'payer_status_id': 1,  # активный по умолчанию
                    'tax_regime_id': tax_regime.regime_id,
                    'region_key': region.region_id,
                    'opf_id': 1,  # по умолчанию
                    'origin_id': 1,  # по умолчанию
                    'notes': 'Создан через личный кабинет сотрудника'
                }
                
                # Добавляем специфичные поля в зависимости от типа плательщика
                if payer_type_id == 1:  # Физлицо
                    if not request.data.get('fio'):
                        return Response(
                            {'error': 'Для физического лица обязательно указать ФИО'}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    taxpayer_data.update({
                        'fio': request.data.get('fio'),
                        'birth_date': request.data.get('birth_date') or None,
                        'registration_address': request.data.get('registration_address') or '',
                        'fact_address': request.data.get('fact_address') or ''
                    })
                elif payer_type_id in [2, 3]:  # ИП или Юрлицо
                    if not request.data.get('full_name'):
                        return Response(
                            {'error': 'Для ИП и юридических лиц обязательно указать полное наименование'}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    taxpayer_data.update({
                        'full_name': request.data.get('full_name'),
                        'short_name': request.data.get('short_name') or '',
                        'ogrn': request.data.get('ogrn') or '',
                        'registration_date': request.data.get('registration_date') or None,
                        'registration_address': request.data.get('registration_address') or '',
                        'fact_address': request.data.get('fact_address') or '',
                        'executive_list': request.data.get('executive_list') or '',
                        'bank_detals': request.data.get('bank_detals') or ''
                    })
                
                # Создаем налогоплательщика
                taxpayer = Taxpayer.objects.create(**taxpayer_data)
                
                # Генерируем случайный пароль
                password = self.generate_password()
                
                # Создаем запись в taxpayer_auth
                TaxpayerAuth.objects.create(
                    inn=inn,
                    password_hash=make_password(password)
                )
                
                # Сериализуем ответ
                serializer = TaxpayerSerializer(taxpayer)
                
                return Response({
                    'taxpayer': serializer.data,
                    'password': password,
                    'message': 'Налогоплательщик успешно создан'
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании налогоплательщика: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def generate_password(self, length=10):
        """Генерирует случайный пароль"""
        import random
        import string
        
        characters = string.ascii_letters + string.digits
        return ''.join(random.choice(characters) for _ in range(length))
    
class RegionListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def list(self, request):
        try:
            regions = Region.objects.all()
            serializer = RegionSerializer(regions, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': f'Ошибка загрузки регионов: {str(e)}'}, status=500)
        
class TaxRegimeListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def list(self, request):
        try:
            regimes = TaxRegime.objects.all()
            serializer = TaxRegimeSerializer(regimes, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': f'Ошибка загрузки налоговых режимов: {str(e)}'}, status=500)
        
class ResetTaxpayerPasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        inn = request.data.get('inn')
        if not inn:
            return Response({'error': 'ИНН обязателен'}, status=400)

        try:
            with transaction.atomic():
                # Проверяем, существует ли налогоплательщик
                taxpayer = Taxpayer.objects.get(inn=inn)
                auth_record = TaxpayerAuth.objects.get(inn=inn)

                # Генерируем новый пароль
                new_password = self.generate_password()
                auth_record.password_hash = make_password(new_password)
                auth_record.save()

                return Response({
                    'message': 'Пароль успешно сброшен',
                    'new_password': new_password
                })

        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик с таким ИНН не найден'}, status=404)
        except TaxpayerAuth.DoesNotExist:
            return Response({'error': 'Запись аутентификации не найдена'}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка при сбросе пароля: {str(e)}'}, status=500)

    def generate_password(self, length=10):
        import random
        import string
        characters = string.ascii_letters + string.digits
        return ''.join(random.choice(characters) for _ in range(length))
    
class AvailableOfficersAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            officers = TaxOfficer.objects.all()
            data = [{
                'tax_officer_id': officer.tax_officer_id,
                'tax_officer_name': officer.tax_officer_name,
                'unit': officer.unit
            } for officer in officers]
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
        
class InspectionBaseListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT inspection_base_id, inspection_base_name FROM inspection_base")
                rows = cursor.fetchall()
            bases = [{'id': row[0], 'name': row[1]} for row in rows]
            return Response(bases)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class InspectionTypeListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT inspection_type_id, inspection_name_id FROM inspection_type")
                rows = cursor.fetchall()
            types = [{'id': row[0], 'name': row[1]} for row in rows]
            return Response(types)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
        
# backend/views.py

class ViolationTypeListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT violation_type_id, violation_name, violation_code FROM violation_type")
                rows = cursor.fetchall()
            types = [{'id': row[0], 'name': row[1], 'code': row[2]} for row in rows]
            return Response(types)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class TaxPeriodListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            periods = TaxPeriod.objects.all()
            data = [{'period_id': p.period_id, 'period_name': p.period_name} for p in periods]
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class InspectionViolationsListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request, inspection_id):
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT v.violation_id, v.sum_to_pay, v.violation_type_id, v.period_id, 
                           vt.violation_name, tp.period_name
                    FROM identified_violation v
                    INNER JOIN violation_type vt ON v.violation_type_id = vt.violation_type_id
                    INNER JOIN tax_period tp ON v.period_id = tp.period_id
                    WHERE v.inspection_id = %s
                """, [inspection_id])
                rows = cursor.fetchall()
            violations = []
            for row in rows:
                violations.append({
                    'violation_id': row[0],
                    'sum_to_pay': float(row[1]) if row[1] else 0,
                    'violation_type_id': row[2],
                    'period_id': row[3],
                    'violation_type_name': row[4],
                    'period_name': row[5]
                })
            return Response(violations)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class CreateViolationAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        try:
            inspection_id = request.data.get('inspection_id')
            violation_type_id = request.data.get('violation_type_id')
            sum_to_pay = request.data.get('sum_to_pay')
            period_id = request.data.get('period_id')

            if not all([inspection_id, violation_type_id, period_id]):
                return Response({'error': 'Не указаны обязательные поля'}, status=400)

            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO identified_violation (inspection_id, violation_type_id, sum_to_pay, period_id)
                    VALUES (%s, %s, %s, %s)
                    RETURNING violation_id
                """, [inspection_id, violation_type_id, sum_to_pay, period_id])
                violation_id = cursor.fetchone()[0]

            return Response({'violation_id': violation_id}, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class UpdateViolationAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, violation_id):
        try:
            violation_type_id = request.data.get('violation_type_id')
            sum_to_pay = request.data.get('sum_to_pay')
            period_id = request.data.get('period_id')

            updates = []
            params = []

            if violation_type_id is not None:
                updates.append("violation_type_id = %s")
                params.append(violation_type_id)
            if sum_to_pay is not None:
                updates.append("sum_to_pay = %s")
                params.append(sum_to_pay)
            if period_id is not None:
                updates.append("period_id = %s")
                params.append(period_id)

            if not updates:
                return Response({'error': 'Нет данных для обновления'}, status=400)

            params.append(violation_id)

            with connection.cursor() as cursor:
                cursor.execute(f"""
                    UPDATE identified_violation 
                    SET {', '.join(updates)}
                    WHERE violation_id = %s
                """, params)

            return Response({'message': 'Нарушение обновлено'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class DeleteViolationAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def delete(self, request, violation_id):
        try:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM identified_violation WHERE violation_id = %s", [violation_id])
            return Response({'message': 'Нарушение удалено'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
        
class UpdateInspectionStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, inspection_id):
        try:
            new_status = request.data.get('inspection_type_status_id')
            
            if new_status not in [1, 2, 3, 4]:
                return Response({'error': 'Неверный статус'}, status=400)

            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE inspection 
                    SET inspection_type_status_id = %s 
                    WHERE inspection_id = %s
                """, [new_status, inspection_id])

            return Response({'message': 'Статус проверки обновлен'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
        
class AllInspectionsListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            # Проверяем, является ли сотрудник старшим инспектором или руководителем
            user_inn = request.user.username
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            if not worker_auth.tax_officer or worker_auth.tax_officer.role_id < 2:
                return Response(
                    {'error': 'Недостаточно прав для просмотра всех проверок'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Получаем все проверки
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT DISTINCT i.inspection_id, i.inspection_date, i.inspection_type_id, 
                           i.inspection_reason, i.inspection_type_status_id,
                           t.taxpayer_id, t.inn, t.fio, t.full_name, t.short_name
                    FROM inspection i
                    INNER JOIN taxpayer t ON i.taxpayer_id = t.taxpayer_id
                    ORDER BY i.inspection_date DESC
                """)
                results = cursor.fetchall()
            
            inspections = []
            for row in results:
                inspection = {
                    'inspection_id': row[0],
                    'inspection_date': row[1],
                    'inspection_type_id': row[2],
                    'inspection_reason': row[3],
                    'inspection_type_status_id': row[4],
                    'taxpayer': {
                        'taxpayer_id': row[5],
                        'inn': row[6],
                        'fio': row[7],
                        'full_name': row[8],
                        'short_name': row[9]
                    }
                }
                inspections.append(inspection)
            
            return Response(inspections)
                
        except WorkerAuth.DoesNotExist:
            return Response([])
        except Exception as e:
            print(f"Error in AllInspectionsListAPIView: {e}")
            return Response({'error': str(e)}, status=500)
        
class CreateWorkerAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        try:
            with transaction.atomic():
                inn = request.data.get('inn')
                tax_officer_name = request.data.get('tax_officer_name')
                unit = request.data.get('unit')
                role_id = request.data.get('role_id')

                # Валидация обязательных полей
                if not all([inn, tax_officer_name, unit, role_id]):
                    return Response(
                        {'error': 'Все поля обязательны для заполнения'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Проверяем уникальность ИНН
                if WorkerAuth.objects.filter(inn=inn).exists():
                    return Response(
                        {'error': 'Сотрудник с таким ИНН уже существует'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Получаем следующий доступный tax_officer_id
                with connection.cursor() as cursor:
                    cursor.execute("SELECT COALESCE(MAX(tax_officer_id), 0) + 1 FROM tax_officer")
                    next_tax_officer_id = cursor.fetchone()[0]

                # Создаем запись в tax_officer с явным указанием ID
                tax_officer = TaxOfficer.objects.create(
                    tax_officer_id=next_tax_officer_id,
                    tax_officer_name=tax_officer_name,
                    unit=unit,
                    role_id=role_id
                )

                # Генерируем случайный пароль
                password = self.generate_password()

                # Создаем запись в worker_auth
                WorkerAuth.objects.create(
                    inn=inn,
                    password_hash=make_password(password),
                    tax_officer=tax_officer
                )

                return Response({
                    'message': 'Сотрудник успешно создан',
                    'worker_id': tax_officer.tax_officer_id,
                    'password': password
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании сотрудника: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def generate_password(self, length=10):
        import random
        import string
        characters = string.ascii_letters + string.digits
        return ''.join(random.choice(characters) for _ in range(length))
    
class ResetWorkerPasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        inn = request.data.get('inn')
        if not inn:
            return Response({'error': 'ИНН обязателен'}, status=400)

        try:
            with transaction.atomic():
                # Проверяем, существует ли сотрудник
                worker_auth = WorkerAuth.objects.get(inn=inn)

                # Генерируем новый пароль
                new_password = self.generate_password()
                worker_auth.password_hash = make_password(new_password)
                worker_auth.save()

                return Response({
                    'message': 'Пароль успешно сброшен',
                    'new_password': new_password
                })

        except WorkerAuth.DoesNotExist:
            return Response({'error': 'Сотрудник с таким ИНН не найден'}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка при сбросе пароля: {str(e)}'}, status=500)

    def generate_password(self, length=10):
        import random
        import string
        characters = string.ascii_letters + string.digits
        return ''.join(random.choice(characters) for _ in range(length))
    
class TaxAccrualsListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request, taxpayer_id):
        try:
            taxpayer = Taxpayer.objects.get(taxpayer_id=taxpayer_id)
            
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        ta.tax_accrual_id,
                        ta.accrual_date,
                        ta.accrual_amount,
                        ta.percent_amount,
                        ta.due_date,
                        ta.income_status_id,
                        tt.tax_type_id,
                        tt.tax_type_name,
                        o.object_name,
                        o.object_address,
                        MAX(tp.payment_date) as last_payment_date,
                        COALESCE(SUM(tp.payment_amount), 0) as paid_amount
                    FROM tax_accrual ta
                    LEFT JOIN tax_type tt ON ta.tax_type_id = tt.tax_type_id
                    LEFT JOIN taxable_object o ON ta.object_id = o.object_id
                    LEFT JOIN tax_payment tp ON ta.tax_accrual_id = tp.tax_income_id
                    WHERE ta.taxpayer_id = %s
                    GROUP BY 
                        ta.tax_accrual_id, ta.accrual_date, ta.accrual_amount, 
                        ta.percent_amount, ta.due_date, ta.income_status_id,
                        tt.tax_type_id, tt.tax_type_name, o.object_name, 
                        o.object_address
                    ORDER BY ta.accrual_date DESC
                """, [taxpayer_id])
                
                results = cursor.fetchall()
            
            print(f"DEBUG: Found {len(results)} accruals for taxpayer {taxpayer_id}")  # Отладочная информация
            
            accruals = []
            for row in results:
                accrual = {
                    'tax_accrual_id': row[0],
                    'accrual_date': row[1],
                    'accrual_amount': float(row[2]) if row[2] else 0,
                    'percent_amount': float(row[3]) if row[3] else 0,
                    'due_date': row[4],
                    'income_status_id': row[5],
                    'tax_type_id': row[6],
                    'tax_type_name': row[7],
                    'object_name': row[8],
                    'object_address': row[9],
                    'payment_date': row[10],
                    'paid_amount': float(row[11]) if row[11] else 0,
                }
                
                # Общая сумма (основной долг + пени)
                total_amount = accrual['accrual_amount'] + accrual['percent_amount']
                accrual['total_amount'] = total_amount
                
                # Остаток к оплате
                accrual['remaining_amount'] = total_amount - accrual['paid_amount']
                
                # Статус оплаты
                if accrual['paid_amount'] >= total_amount:
                    accrual['payment_status'] = 'оплачено'
                    accrual['status_color'] = 'success'
                elif accrual['paid_amount'] > 0:
                    accrual['payment_status'] = 'частично оплачено'
                    accrual['status_color'] = 'warning'
                elif accrual['due_date'] and timezone.now().date() > accrual['due_date']:
                    accrual['payment_status'] = 'просрочено'
                    accrual['status_color'] = 'danger'
                else:
                    accrual['payment_status'] = 'начислено'
                    accrual['status_color'] = 'primary'
                
                accruals.append(accrual)
            
            return Response(accruals)
            
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)
        except Exception as e:
            print(f"ERROR loading accruals: {str(e)}")  # Отладочная информация
            return Response({'error': f'Ошибка загрузки начислений: {str(e)}'}, status=500)

class UpdateTaxAccrualAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def patch(self, request, accrual_id):
        try:
            # Проверяем права - только старшие инспекторы и руководители
            user_inn = request.user.username
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            if not worker_auth.tax_officer or worker_auth.tax_officer.role_id < 2:
                return Response(
                    {'error': 'Недостаточно прав для редактирования начислений'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            with connection.cursor() as cursor:
                # Получаем текущие данные начисления
                cursor.execute("""
                    SELECT tax_accrual_id, accrual_amount, percent_amount, due_date, tax_type_id
                    FROM tax_accrual WHERE tax_accrual_id = %s
                """, [accrual_id])
                current_data = cursor.fetchone()
                
                if not current_data:
                    return Response({'error': 'Начисление не найдено'}, status=404)
                
                # Подготавливаем данные для обновления
                update_fields = []
                params = []
                
                if 'accrual_amount' in request.data:
                    update_fields.append("accrual_amount = %s")
                    params.append(request.data['accrual_amount'])
                
                if 'percent_amount' in request.data:
                    update_fields.append("percent_amount = %s")
                    params.append(request.data['percent_amount'])
                
                if 'due_date' in request.data:
                    update_fields.append("due_date = %s")
                    params.append(request.data['due_date'])
                
                if 'tax_type_id' in request.data:
                    update_fields.append("tax_type_id = %s")
                    params.append(request.data['tax_type_id'])
                
                if update_fields:
                    params.append(accrual_id)
                    cursor.execute(f"""
                        UPDATE tax_accrual 
                        SET {', '.join(update_fields)}
                        WHERE tax_accrual_id = %s
                    """, params)
                
                # Получаем обновленные данные
                cursor.execute("""
                    SELECT 
                        ta.tax_accrual_id,
                        ta.accrual_date,
                        ta.accrual_amount,
                        ta.percent_amount,
                        ta.due_date,
                        tt.tax_type_name,
                        COALESCE(SUM(tp.payment_amount), 0) as paid_amount
                    FROM tax_accrual ta
                    LEFT JOIN tax_type tt ON ta.tax_type_id = tt.tax_type_id
                    LEFT JOIN tax_payment tp ON ta.tax_accrual_id = tp.tax_income_id
                    WHERE ta.tax_accrual_id = %s
                    GROUP BY ta.tax_accrual_id, ta.accrual_date, ta.accrual_amount, 
                             ta.percent_amount, ta.due_date, tt.tax_type_name
                """, [accrual_id])
                
                updated_data = cursor.fetchone()
                
                response_data = {
                    'tax_accrual_id': updated_data[0],
                    'accrual_date': updated_data[1],
                    'accrual_amount': float(updated_data[2]) if updated_data[2] else 0,
                    'percent_amount': float(updated_data[3]) if updated_data[3] else 0,
                    'due_date': updated_data[4],
                    'tax_type_name': updated_data[5],
                    'paid_amount': float(updated_data[6]) if updated_data[6] else 0,
                    'total_amount': (float(updated_data[2]) if updated_data[2] else 0) + 
                                   (float(updated_data[3]) if updated_data[3] else 0)
                }
                
                return Response(response_data)
                
        except WorkerAuth.DoesNotExist:
            return Response({'error': 'Сотрудник не найден'}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка при обновлении начисления: {str(e)}'}, status=500)
        
class WorkerSearchAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        search_type = request.query_params.get('type', 'simple')
        query = request.query_params.get('query', '')
        
        if search_type == 'simple':
            return self.simple_search(query)
        elif search_type == 'advanced':
            return self.advanced_search(request.query_params)
        else:
            return Response({'error': 'Неверный тип поиска'}, status=400)

    def simple_search(self, query):
        if not query:
            return Response({'error': 'Пустой запрос'}, status=400)
        
        try:
            # Ищем только по полям таблицы tax_officer
            workers = TaxOfficer.objects.filter(
                models.Q(tax_officer_name__icontains=query) |
                models.Q(unit__icontains=query)
            )[:100]
            
            serializer = WorkerSearchSerializer(workers, many=True)
            return Response({'results': serializer.data})
            
        except Exception as e:
            print(f"Error in worker search: {str(e)}")
            return Response({'error': f'Ошибка поиска: {str(e)}'}, status=500)

    def advanced_search(self, params):
        try:
            queryset = TaxOfficer.objects.all()
            
            if params.get('tax_officer_name'):
                queryset = queryset.filter(tax_officer_name__icontains=params['tax_officer_name'])
            
            if params.get('unit'):
                queryset = queryset.filter(unit__icontains=params['unit'])
            
            if params.get('role_id'):
                queryset = queryset.filter(role_id=params['role_id'])
            
            # Убираем поиск по ИНН, так как его нет в tax_officer
            
            workers = queryset[:100]
            serializer = WorkerSearchSerializer(workers, many=True)
            return Response({'results': serializer.data})
            
        except Exception as e:
            print(f"Error in advanced worker search: {str(e)}")
            return Response({'error': f'Ошибка расширенного поиска: {str(e)}'}, status=500)

class WorkerDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request, worker_id):
        try:
            worker = TaxOfficer.objects.get(tax_officer_id=worker_id)
            serializer = WorkerDetailSerializer(worker)
            return Response(serializer.data)
        except TaxOfficer.DoesNotExist:
            return Response({'error': 'Сотрудник не найден'}, status=404)

    def patch(self, request, worker_id):
        try:
            worker = TaxOfficer.objects.get(tax_officer_id=worker_id)
            serializer = WorkerUpdateSerializer(worker, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
            
        except TaxOfficer.DoesNotExist:
            return Response({'error': 'Сотрудник не найден'}, status=404)

class GenerateReportAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.register_fonts()
        self.line_height = 14
        self.section_spacing = 25
        self.page_margin = 50

    def register_fonts(self):
        """Регистрируем шрифты, поддерживающие кириллицу"""
        try:
            arial_path = 'C:/Windows/Fonts/arial.ttf'
            if os.path.exists(arial_path):
                pdfmetrics.registerFont(TTFont('Arial', arial_path))
                pdfmetrics.registerFont(TTFont('Arial-Bold', arial_path))
                print("Шрифт Arial зарегистрирован")
            else:
                print("Шрифт Arial не найден, будет использован стандартный шрифт")
        except Exception as e:
            print(f"Ошибка при регистрации шрифтов: {e}")

    def set_font(self, pdf, size=10, bold=False):
        """Устанавливаем шрифт с поддержкой кириллицы"""
        try:
            font_name = "Arial-Bold" if bold else "Arial"
            pdf.setFont(font_name, size)
        except:
            font_name = "Helvetica-Bold" if bold else "Helvetica"
            pdf.setFont(font_name, size)

    def post(self, request):
        try:
            print(f"DEBUG: Starting report generation with params: {request.data}")
            
            user_inn = request.user.username
            try:
                worker_auth = WorkerAuth.objects.get(inn=user_inn)
                tax_officer = worker_auth.tax_officer if worker_auth.tax_officer else None
            except WorkerAuth.DoesNotExist:
                tax_officer = None
            
            report_params = request.data
            buffer = BytesIO()
            
            pdf = canvas.Canvas(buffer, pagesize=A4)
            width, height = A4
            
            self.generate_report_content(pdf, report_params, width, height, tax_officer)
            
            pdf.save()
            buffer.seek(0)
            
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="tax_report_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
            
            print("DEBUG: Report generated successfully")
            return response
            
        except Exception as e:
            print(f"ERROR in report generation: {str(e)}")
            import traceback
            print(f"TRACEBACK: {traceback.format_exc()}")
            
            return Response(
                {'error': f'Ошибка генерации отчета: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def generate_report_content(self, pdf, params, width, height, tax_officer=None):
        """Генерация содержимого отчета с правильным форматированием"""
        try:
            print("DEBUG: Starting report content generation")
            
            y_position = height - 40
            
            # Шапка отчета
            self.set_font(pdf, 16, True)
            header_text = "ФЕДЕРАЛЬНАЯ НАЛОГОВАЯ СЛУЖБА РОССИЙСКОЙ ФЕДЕРАЦИИ"
            pdf.drawCentredString(width/2, y_position, header_text)
            
            y_position -= 40
            
            # Информация о дате генерации
            self.set_font(pdf, 10)
            report_date = f"Отчет сгенерирован: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
            pdf.drawCentredString(width/2, y_position, report_date)
            
            y_position -= 20
            
            # Информация о сотруднике
            if tax_officer:
                officer_info = f"Сотрудник: {tax_officer.tax_officer_name}, {tax_officer.unit if tax_officer.unit else 'Не указано'}"
                pdf.drawCentredString(width/2, y_position, officer_info)
            
            y_position -= 40
            
            # Заголовок отчета
            self.set_font(pdf, 14, True)
            pdf.drawCentredString(width/2, y_position, "Аналитический отчет по работе налоговой")
            
            # Добавляем информацию о примененных фильтрах
            filter_info = self.get_filter_info(params)
            self.set_font(pdf, 10)
            y_position -= 20
            pdf.drawCentredString(width/2, y_position, f"Параметры отчета: {filter_info}")
            
            y_position -= 30

            # Основные показатели
            if params.get('sections', {}).get('basicInfo'):
                print("DEBUG: Generating basic info section")
                y_position = self.add_basic_info_section(pdf, params, y_position, width, height)
                
            # Финансовая сводка
            if params.get('sections', {}).get('financialSummary'):
                print("DEBUG: Generating financial section")
                y_position = self.add_financial_section(pdf, params, y_position, width, height)
                
            # Анализ рисков
            if params.get('sections', {}).get('riskAnalysis'):
                print("DEBUG: Generating risk analysis section")
                y_position = self.add_risk_analysis_section(pdf, params, y_position, width, height)
                
            # Проверочная деятельность
            if params.get('sections', {}).get('inspections'):
                print("DEBUG: Generating inspections section")
                y_position = self.add_inspections_section(pdf, params, y_position, width, height)

            # Декларационная работа
            if params.get('sections', {}).get('declarations'):
                print("DEBUG: Generating declarations section")
                y_position = self.add_declarations_section(pdf, params, y_position, width, height)

            # Заявления на снижение
            if params.get('sections', {}).get('accruals'):
                print("DEBUG: Generating accruals section")
                y_position = self.add_accruals_section(pdf, params, y_position, width, height)

            print("DEBUG: Report content generation completed")
                
        except Exception as e:
            print(f"ERROR in generate_report_content: {str(e)}")
            import traceback
            print(f"TRACEBACK in generate_report_content: {traceback.format_exc()}")
            raise

    def check_page_break(self, pdf, y_position, lines_needed=1, height=A4[1]):
        """Проверяет, нужно ли переносить на новую страницу"""
        required_space = lines_needed * self.line_height + 50
        if y_position < required_space:
            pdf.showPage()
            return height - 40
        return y_position

    def add_basic_info_section(self, pdf, params, y_position, width, height):
        """Добавление раздела с основной информацией"""
        try:
            y_position = self.check_page_break(pdf, y_position, 10, height)
            
            self.set_font(pdf, 14, True)
            pdf.drawString(self.page_margin, y_position, "1. Основные показатели")
            y_position -= self.section_spacing
            
            where_condition = self.build_where_condition(params)
            
            with connection.cursor() as cursor:
                # Общее количество налогоплательщиков
                cursor.execute(f"SELECT COUNT(*) FROM taxpayer t WHERE {where_condition}")
                total_taxpayers = cursor.fetchone()[0] or 0
                
                # Распределение по типам
                cursor.execute(f"""
                    SELECT pt.name, COUNT(*) 
                    FROM taxpayer t
                    JOIN taxpayer_type pt ON t.payer_type_id = pt.id_taxpayer_type
                    WHERE {where_condition}
                    GROUP BY pt.name
                """)
                type_distribution = cursor.fetchall()
                
                # Распределение по регионам
                cursor.execute(f"""
                    SELECT r.name, COUNT(*) 
                    FROM taxpayer t
                    JOIN region r ON t.region_key = r.region_id
                    WHERE {where_condition}
                    GROUP BY r.name
                    ORDER BY COUNT(*) DESC
                    LIMIT 10
                """)
                region_distribution = cursor.fetchall()

                # Распределение по налоговым режимам
                cursor.execute(f"""
                    SELECT tr.name, COUNT(*) 
                    FROM taxpayer t
                    JOIN tax_regime tr ON t.tax_regime_id = tr.regime_id
                    WHERE {where_condition}
                    GROUP BY tr.name
                    ORDER BY COUNT(*) DESC
                """)
                regime_distribution = cursor.fetchall()
            
            # Вывод данных
            self.set_font(pdf, 10)
            y_position = self.check_page_break(pdf, y_position, 2, height)
            pdf.drawString(self.page_margin + 20, y_position, f"Общее количество налогоплательщиков: {total_taxpayers}")
            y_position -= self.line_height
            
            if total_taxpayers == 0:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Нет данных для отображения")
                y_position -= self.line_height
                return y_position - 20
            
            if type_distribution:
                y_position = self.check_page_break(pdf, y_position, len(type_distribution) + 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Распределение по типам:")
                y_position -= self.line_height
                
                for type_name, count in type_distribution:
                    y_position = self.check_page_break(pdf, y_position, 1, height)
                    pdf.drawString(self.page_margin + 40, y_position, f"- {type_name}: {count}")
                    y_position -= self.line_height
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Распределение по типам: нет данных")
                y_position -= self.line_height
                    
            if region_distribution:
                y_position = self.check_page_break(pdf, y_position, len(region_distribution) + 3, height)
                y_position -= 10
                pdf.drawString(self.page_margin + 20, y_position, "Топ регионов:")
                y_position -= self.line_height
                
                for region_name, count in region_distribution:
                    y_position = self.check_page_break(pdf, y_position, 1, height)
                    pdf.drawString(self.page_margin + 40, y_position, f"- {region_name}: {count}")
                    y_position -= self.line_height
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                y_position -= 10
                pdf.drawString(self.page_margin + 20, y_position, "Топ регионов: нет данных")
                y_position -= self.line_height

            if regime_distribution:
                y_position = self.check_page_break(pdf, y_position, len(regime_distribution) + 3, height)
                y_position -= 10
                pdf.drawString(self.page_margin + 20, y_position, "Распределение по налоговым режимам:")
                y_position -= self.line_height
                
                for regime_name, count in regime_distribution:
                    y_position = self.check_page_break(pdf, y_position, 1, height)
                    pdf.drawString(self.page_margin + 40, y_position, f"- {regime_name}: {count}")
                    y_position -= self.line_height
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                y_position -= 10
                pdf.drawString(self.page_margin + 20, y_position, "Распределение по налоговым режимам: нет данных")
                y_position -= self.line_height
                
            return y_position - 20
            
        except Exception as e:
            print(f"ERROR in add_basic_info_section: {str(e)}")
            return y_position - 50

    def add_financial_section(self, pdf, params, y_position, width, height):
        """Добавление финансового раздела"""
        try:
            y_position = self.check_page_break(pdf, y_position, 15, height)
            
            self.set_font(pdf, 14, True)
            pdf.drawString(self.page_margin, y_position, "2. Финансовая сводка")
            y_position -= self.section_spacing
            
            where_condition = self.build_where_condition(params, 't')

            with connection.cursor() as cursor:
                # Сумма начисленных налогов
                cursor.execute(f"""
                    SELECT COALESCE(SUM(ta.accrual_amount), 0) 
                    FROM tax_accrual ta
                    JOIN taxpayer t ON ta.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                """)
                total_accruals = cursor.fetchone()[0] or 0
                
                # Сумма уплаченных налогов
                cursor.execute(f"""
                    SELECT COALESCE(SUM(tp.payment_amount), 0) 
                    FROM tax_payment tp
                    JOIN tax_accrual ta ON tp.tax_income_id = ta.tax_accrual_id
                    JOIN taxpayer t ON ta.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                """)
                total_payments = cursor.fetchone()[0] or 0
                
                # Задолженность
                cursor.execute(f"""
                    SELECT COALESCE(SUM(ta.accrual_amount + COALESCE(ta.percent_amount, 0) - COALESCE(tp.total_paid, 0)), 0)
                    FROM tax_accrual ta
                    JOIN taxpayer t ON ta.taxpayer_id = t.taxpayer_id
                    LEFT JOIN (
                        SELECT tax_income_id, SUM(payment_amount) as total_paid
                        FROM tax_payment
                        GROUP BY tax_income_id
                    ) tp ON ta.tax_accrual_id = tp.tax_income_id
                    WHERE {where_condition} 
                    AND (ta.accrual_amount + COALESCE(ta.percent_amount, 0)) > COALESCE(tp.total_paid, 0)
                """)
                total_debt = cursor.fetchone()[0] or 0
                
                # Процент оплаченных налогов
                payment_percentage = (total_payments / total_accruals * 100) if total_accruals > 0 else 0
                
                # Распределение по типам налогов
                cursor.execute(f"""
                    SELECT tt.tax_type_name, SUM(ta.accrual_amount)
                    FROM tax_accrual ta
                    JOIN tax_type tt ON ta.tax_type_id = tt.tax_type_id
                    JOIN taxpayer t ON ta.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                    GROUP BY tt.tax_type_name
                    ORDER BY SUM(ta.accrual_amount) DESC
                    LIMIT 10
                """)
                tax_type_distribution = cursor.fetchall()
            
            self.set_font(pdf, 10)
            y_position = self.check_page_break(pdf, y_position, 5, height)
            pdf.drawString(self.page_margin + 20, y_position, f"Общая сумма начисленных налогов: {float(total_accruals):,.2f} руб.")
            y_position -= self.line_height
            pdf.drawString(self.page_margin + 20, y_position, f"Общая сумма уплаченных налогов: {float(total_payments):,.2f} руб.")
            y_position -= self.line_height
            pdf.drawString(self.page_margin + 20, y_position, f"Общая задолженность: {float(total_debt):,.2f} руб.")
            y_position -= self.line_height
            pdf.drawString(self.page_margin + 20, y_position, f"Процент оплаченных налогов: {payment_percentage:.1f}%")
            y_position -= self.line_height * 2
            
            if tax_type_distribution:
                y_position = self.check_page_break(pdf, y_position, len(tax_type_distribution) + 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Топ видов налогов по начислениям:")
                y_position -= self.line_height
                
                for tax_type, amount in tax_type_distribution:
                    y_position = self.check_page_break(pdf, y_position, 1, height)
                    pdf.drawString(self.page_margin + 40, y_position, f"- {tax_type}: {float(amount):,.2f} руб.")
                    y_position -= self.line_height
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Топ видов налогов по начислениям: нет данных")
                y_position -= self.line_height
            
            return y_position - 20
            
        except Exception as e:
            print(f"ERROR in add_financial_section: {str(e)}")
            return y_position - 50

    def add_risk_analysis_section(self, pdf, params, y_position, width, height):
        """Добавление анализа рисков"""
        try:
            y_position = self.check_page_break(pdf, y_position, 15, height)
            
            self.set_font(pdf, 14, True)
            pdf.drawString(self.page_margin, y_position, "3. Анализ рисков")
            y_position -= self.section_spacing
            
            where_condition = self.build_where_condition(params, 't')
            
            with connection.cursor() as cursor:
                # Средний RiskScore
                cursor.execute(f"""
                    SELECT AVG(latest_ratings.rating_value) 
                    FROM (
                        SELECT DISTINCT ON (tr.taxpayer_id) tr.rating_value
                        FROM taxpayer_rating tr
                        JOIN taxpayer t ON tr.taxpayer_id = t.taxpayer_id
                        WHERE {where_condition}
                        ORDER BY tr.taxpayer_id, tr.rating_date DESC, tr.rating_id DESC
                    ) AS latest_ratings
                """)
                result = cursor.fetchone()
                avg_risk_score = result[0] if result and result[0] is not None else 0
                
                # Распределение по группам риска
                cursor.execute(f"""
                    SELECT 
                        COUNT(CASE WHEN rating_value <= 30 THEN 1 END) as low_risk,
                        COUNT(CASE WHEN rating_value > 30 AND rating_value <= 70 THEN 1 END) as medium_risk,
                        COUNT(CASE WHEN rating_value > 70 THEN 1 END) as high_risk
                    FROM (
                        SELECT DISTINCT ON (tr.taxpayer_id) tr.rating_value
                        FROM taxpayer_rating tr
                        JOIN taxpayer t ON tr.taxpayer_id = t.taxpayer_id
                        WHERE {where_condition}
                        ORDER BY tr.taxpayer_id, tr.rating_date DESC, tr.rating_id DESC
                    ) AS latest_ratings
                """)
                risk_distribution = cursor.fetchone()
                
                # Топ плательщиков с высоким риском
                cursor.execute(f"""
                    SELECT t.inn, COALESCE(t.fio, t.full_name, 'Не указано') as name, tr.rating_value
                    FROM taxpayer_rating tr
                    JOIN taxpayer t ON tr.taxpayer_id = t.taxpayer_id
                    WHERE (t.taxpayer_id, tr.rating_date, tr.rating_id) IN (
                        SELECT taxpayer_id, MAX(rating_date), MAX(rating_id)
                        FROM taxpayer_rating
                        GROUP BY taxpayer_id
                    )
                    AND {where_condition}
                    AND tr.rating_value > 70
                    ORDER BY tr.rating_value DESC
                    LIMIT 10
                """)
                high_risk_taxpayers = cursor.fetchall()
        
            self.set_font(pdf, 10)
            y_position = self.check_page_break(pdf, y_position, 3, height)
            pdf.drawString(self.page_margin + 20, y_position, f"Средний RiskScore: {float(avg_risk_score):.2f}")
            y_position -= self.line_height * 2
            
            if risk_distribution and any(risk_distribution):
                low, medium, high = risk_distribution
                y_position = self.check_page_break(pdf, y_position, 5, height)
                pdf.drawString(self.page_margin + 20, y_position, "Распределение по группам риска:")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Низкий риск (0-30): {low} плательщиков")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Средний риск (31-70): {medium} плательщиков")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Высокий риск (71-100): {high} плательщиков")
                y_position -= self.line_height * 2
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Распределение по группам риска: нет данных")
                y_position -= self.line_height * 2
                
            if high_risk_taxpayers:
                y_position = self.check_page_break(pdf, y_position, len(high_risk_taxpayers) + 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Топ-10 плательщиков с высоким риском:")
                y_position -= self.line_height
                
                for inn, name, risk_score in high_risk_taxpayers:
                    y_position = self.check_page_break(pdf, y_position, 1, height)
                    if len(name) > 40:
                        name = name[:40] + '...'
                    pdf.drawString(self.page_margin + 40, y_position, f"- {name} (ИНН: {inn}): {float(risk_score):.2f}")
                    y_position -= self.line_height
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Топ-10 плательщиков с высоким риском: нет данных")
                y_position -= self.line_height
            
            return y_position - 20
            
        except Exception as e:
            print(f"ERROR in add_risk_analysis_section: {str(e)}")
            return y_position - 50

    def add_inspections_section(self, pdf, params, y_position, width, height):
        """Добавление раздела по проверкам"""
        try:
            y_position = self.check_page_break(pdf, y_position, 15, height)
            
            self.set_font(pdf, 14, True)
            pdf.drawString(self.page_margin, y_position, "4. Проверочная деятельность")
            y_position -= self.section_spacing
            
            where_condition = self.build_where_condition(params, 't')
            
            with connection.cursor() as cursor:
                # Статистика проверок
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total_inspections,
                        COUNT(CASE WHEN i.inspection_type_status_id = 1 THEN 1 END) as planned,
                        COUNT(CASE WHEN i.inspection_type_status_id = 2 THEN 1 END) as completed,
                        COUNT(CASE WHEN i.inspection_type_status_id = 3 THEN 1 END) as in_progress
                    FROM inspection i
                    JOIN taxpayer t ON i.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                """)
                inspection_stats = cursor.fetchone()
                
                # Выявленные нарушения
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total_violations,
                        COALESCE(SUM(iv.sum_to_pay), 0) as total_fines
                    FROM identified_violation iv
                    JOIN inspection i ON iv.inspection_id = i.inspection_id
                    JOIN taxpayer t ON i.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                """)
                violation_stats = cursor.fetchone()
                
                # Эффективность проверок по типам
                cursor.execute(f"""
                    SELECT it.inspection_name_id, COUNT(*)
                    FROM inspection i
                    JOIN inspection_type it ON i.inspection_type_id = it.inspection_type_id
                    JOIN taxpayer t ON i.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                    GROUP BY it.inspection_name_id
                    ORDER BY COUNT(*) DESC
                    LIMIT 5
                """)
                inspection_types = cursor.fetchall()
            
            self.set_font(pdf, 10)
            if inspection_stats and any(inspection_stats):
                total, planned, completed, in_progress = inspection_stats
                y_position = self.check_page_break(pdf, y_position, 6, height)
                pdf.drawString(self.page_margin + 20, y_position, "Статистика проверок:")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Всего проверок: {total}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Запланировано: {planned}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Завершено: {completed}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- В процессе: {in_progress}")
                y_position -= self.line_height * 2
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Статистика проверок: нет данных")
                y_position -= self.line_height * 2
                
            if violation_stats and any(violation_stats):
                total_violations, total_fines = violation_stats
                y_position = self.check_page_break(pdf, y_position, 4, height)
                pdf.drawString(self.page_margin + 20, y_position, "Выявленные нарушения:")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Количество нарушений: {total_violations}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Сумма доначислений: {float(total_fines):,.2f} руб.")
                y_position -= self.line_height * 2
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Выявленные нарушения: нет данных")
                y_position -= self.line_height * 2
                
            if inspection_types:
                y_position = self.check_page_break(pdf, y_position, len(inspection_types) + 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Типы проверок:")
                y_position -= self.line_height
                
                for inspection_type, count in inspection_types:
                    y_position = self.check_page_break(pdf, y_position, 1, height)
                    pdf.drawString(self.page_margin + 40, y_position, f"- {inspection_type}: {count}")
                    y_position -= self.line_height
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Типы проверок: нет данных")
                y_position -= self.line_height
            
            return y_position - 20
            
        except Exception as e:
            print(f"ERROR in add_inspections_section: {str(e)}")
            return y_position - 50

    def add_declarations_section(self, pdf, params, y_position, width, height):
        """Добавление раздела по декларациям"""
        try:
            y_position = self.check_page_break(pdf, y_position, 10, height)
            
            self.set_font(pdf, 14, True)
            pdf.drawString(self.page_margin, y_position, "5. Декларационная работа")
            y_position -= self.section_spacing
            
            where_condition = self.build_where_condition(params, 't')
            
            with connection.cursor() as cursor:
                # Статистика деклараций
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total_declarations,
                        COUNT(CASE WHEN d.declaration_status_id = 2 THEN 1 END) as submitted,
                        COUNT(CASE WHEN d.declaration_status_id = 3 THEN 1 END) as approved,
                        COUNT(CASE WHEN d.declaration_status_id = 4 THEN 1 END) as rejected
                    FROM tax_declaration d
                    JOIN taxpayer t ON d.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                """)
                declaration_stats = cursor.fetchone()
                
                if declaration_stats:
                    total, submitted, approved, rejected = declaration_stats
                    approval_rate = (approved / total * 100) if total > 0 else 0
            
            self.set_font(pdf, 10)
            if declaration_stats and any(declaration_stats):
                total, submitted, approved, rejected = declaration_stats
                y_position = self.check_page_break(pdf, y_position, 7, height)
                pdf.drawString(self.page_margin + 20, y_position, "Статистика деклараций:")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Всего деклараций: {total}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Подано: {submitted}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Одобрено: {approved}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Отклонено: {rejected}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Процент одобрения: {approval_rate:.1f}%")
                y_position -= self.line_height * 2
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Статистика деклараций: нет данных")
                y_position -= self.line_height * 2
            
            return y_position - 20
            
        except Exception as e:
            print(f"ERROR in add_declarations_section: {str(e)}")
            return y_position - 50

    def add_accruals_section(self, pdf, params, y_position, width, height):
        """Добавление раздела по заявлениям на снижение"""
        try:
            y_position = self.check_page_break(pdf, y_position, 10, height)
            
            self.set_font(pdf, 14, True)
            pdf.drawString(self.page_margin, y_position, "6. Заявления на снижение")
            y_position -= self.section_spacing
            
            where_condition = self.build_where_condition(params, 't')
            
            with connection.cursor() as cursor:
                # Статистика заявлений на снижение
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total_requests,
                        COUNT(CASE WHEN trr.request_status_id = 2 THEN 1 END) as approved,
                        COUNT(CASE WHEN trr.request_status_id = 3 THEN 1 END) as rejected,
                        AVG(trr.requested_reduce_amount)
                    FROM tax_reduce_request trr
                    JOIN taxpayer t ON trr.taxpayer_id = t.taxpayer_id
                    WHERE {where_condition}
                """)
                request_stats = cursor.fetchone()
                
                if request_stats:
                    total_requests, approved, rejected, avg_amount = request_stats
                    approval_rate = (approved / total_requests * 100) if total_requests > 0 else 0
            
            self.set_font(pdf, 10)
            if request_stats and any(request_stats) and total_requests > 0:
                y_position = self.check_page_break(pdf, y_position, 7, height)
                pdf.drawString(self.page_margin + 20, y_position, "Статистика заявлений на снижение:")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Всего заявлений: {total_requests}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Одобрено: {approved}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Отклонено: {rejected}")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Процент одобрения: {approval_rate:.1f}%")
                y_position -= self.line_height
                pdf.drawString(self.page_margin + 40, y_position, f"- Средняя запрашиваемая сумма: {float(avg_amount or 0):.2f} руб.")
                y_position -= self.line_height * 2
            else:
                y_position = self.check_page_break(pdf, y_position, 2, height)
                pdf.drawString(self.page_margin + 20, y_position, "Статистика заявлений на снижение: нет данных")
                y_position -= self.line_height * 2
            
            return y_position - 20
            
        except Exception as e:
            print(f"ERROR in add_accruals_section: {str(e)}")
            return y_position - 50

    def build_where_condition(self, params, table_alias='t'):
        """Строит условие WHERE для SQL-запросов на основе параметров"""
        try:
            conditions = []
            
            regions = params.get('regions', [])
            if regions:
                conditions.append(f"{table_alias}.region_key IN ({','.join(map(str, regions))})")
            
            payer_types = params.get('payerTypes', [])
            if payer_types:
                conditions.append(f"{table_alias}.payer_type_id IN ({','.join(map(str, payer_types))})")
            
            tax_regimes = params.get('taxRegimes', [])
            if tax_regimes:
                conditions.append(f"{table_alias}.tax_regime_id IN ({','.join(map(str, tax_regimes))})")
            
            risk_range = params.get('riskScoreRange', {})
            min_risk = risk_range.get('min', 0)
            max_risk = risk_range.get('max', 100)
            
            if min_risk > 0 or max_risk < 100:
                risk_subquery = f"""
                    (SELECT tr.rating_value 
                     FROM taxpayer_rating tr 
                     WHERE tr.taxpayer_id = {table_alias}.taxpayer_id 
                     ORDER BY tr.rating_date DESC, tr.rating_id DESC 
                     LIMIT 1)
                """
                if min_risk > 0:
                    conditions.append(f"{risk_subquery} >= {min_risk}")
                if max_risk < 100:
                    conditions.append(f"{risk_subquery} <= {max_risk}")
            
            where_condition = " AND ".join(conditions) if conditions else "1=1"
            return where_condition
            
        except Exception as e:
            print(f"ERROR in build_where_condition: {str(e)}")
            return "1=1"

    def get_filter_info(self, params):
        """Формирует строку с информацией о примененных фильтрах"""
        try:
            filters = []
            
            # Регионы с названиями
            regions = params.get('regions', [])
            if regions:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT name FROM region WHERE region_id IN %s", [tuple(regions)])
                    region_names = [row[0] for row in cursor.fetchall()]
                if region_names:
                    filters.append(f"Регионы: {', '.join(region_names)}")
            
            # Типы плательщиков с названиями
            payer_types = params.get('payerTypes', [])
            if payer_types:
                type_names = {
                    1: 'Физические лица',
                    2: 'Индивидуальные предприниматели', 
                    3: 'Юридические лица'
                }
                selected_types = [type_names.get(t, f"Тип {t}") for t in payer_types]
                filters.append(f"Типы плательщиков: {', '.join(selected_types)}")
            
            # Налоговые режимы с названиями
            tax_regimes = params.get('taxRegimes', [])
            if tax_regimes:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT name FROM tax_regime WHERE regime_id IN %s", [tuple(tax_regimes)])
                    regime_names = [row[0] for row in cursor.fetchall()]
                if regime_names:
                    filters.append(f"Налоговые режимы: {', '.join(regime_names)}")
            
            # Диапазон RiskScore
            risk_range = params.get('riskScoreRange', {})
            min_risk = risk_range.get('min', 0)
            max_risk = risk_range.get('max', 100)
            
            if min_risk > 0 or max_risk < 100:
                filters.append(f"RiskScore: {min_risk}-{max_risk}")
            
            return ", ".join(filters) if filters else "все данные"
            
        except Exception as e:
            print(f"ERROR in get_filter_info: {str(e)}")
            return "все данные"