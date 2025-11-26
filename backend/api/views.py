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

        tokens = _make_tokens_for_inn(inn, 'worker')
        return Response({
                "refresh": tokens["refresh"],
                "access": tokens["access"],
                "role": "worker"
            }, status=status.HTTP_200_OK)
    

class CustomTokenRefreshView(TokenRefreshView):
    """
    Refresh, который возвращает access/refresh с inn и user_type.
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

        if not inn or not user_type:
            return Response({"detail": "Refresh токен не содержит данные пользователя"}, status=400)

        # генерируем новый refresh
        new_refresh = RefreshToken()
        new_refresh["inn"] = inn
        new_refresh["user_type"] = user_type

        # новый access
        access = new_refresh.access_token

        return Response({
            "refresh": str(new_refresh),
            "access": str(access),
            "inn": inn,
            "user_type": user_type
        })
    
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
        
class WorkerInspectionsListAPIView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    serializer_class = InspectionSerializer
    
    def get_queryset(self):
        user_inn = self.request.user.username
        try:
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            if worker_auth.tax_officer:
                tax_officer_id = worker_auth.tax_officer.tax_officer_id
                
                # Получаем проверки, в которых участвует текущий сотрудник
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT i.inspection_id, i.inspection_date, i.inspection_type_id, 
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
                    inspection = Inspection(
                        inspection_id=row[0],
                        inspection_date=row[1],
                        inspection_type_id=row[2],
                        inspection_reason=row[3],
                        inspection_type_status_id=row[4]
                    )
                    # Добавляем информацию о налогоплательщике
                    taxpayer = Taxpayer(
                        taxpayer_id=row[5],
                        inn=row[6],
                        fio=row[7],
                        full_name=row[8],
                        short_name=row[9]
                    )
                    inspection.taxpayer = taxpayer
                    inspections.append(inspection)
                
                return inspections
            else:
                return []
                
        except WorkerAuth.DoesNotExist:
            return []

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
                    SELECT toi.tax_officer_id, to2.tax_officer_name, to2.unit
                    FROM tax_officer_inspection toi
                    INNER JOIN tax_officer to2 ON toi.tax_officer_id = to2.tax_officer_id
                    WHERE toi.inspection_id = %s
                """, [inspection_id])
                participants_data = cursor.fetchall()
                
                # Получаем нарушения по проверке
                cursor.execute("""
                    SELECT v.violation_id, v.violation_description, v.violation_amount,
                           v.violation_status_id, v.penalty_amount, v.penalty_status_id
                    FROM violation v
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
                        'violation_description': v[1],
                        'violation_amount': float(v[2]) if v[2] else None,
                        'violation_status_id': v[3],
                        'penalty_amount': float(v[4]) if v[4] else None,
                        'penalty_status_id': v[5]
                    } for v in violations_data
                ]
            }
            
            return Response(inspection)
            
        except Exception as e:
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
                inspection_date = request.data.get('inspection_date')
                inspection_type_id = request.data.get('inspection_type_id', 1)
                inspection_reason = request.data.get('inspection_reason', '')
                participants = request.data.get('participants', [])
                
                # Создаем проверку
                with connection.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO inspection (inspection_date, taxpayer_id, inspection_type_id, 
                                              inspection_reason, inspection_type_status_id)
                        VALUES (%s, %s, %s, %s, 1)
                        RETURNING inspection_id
                    """, [inspection_date, taxpayer_id, inspection_type_id, inspection_reason])
                    inspection_id = cursor.fetchone()[0]
                
                # Добавляем текущего сотрудника как участника
                with connection.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO tax_officer_inspection (tax_officer_id, inspection_id)
                        VALUES (%s, %s)
                    """, [worker_auth.tax_officer.tax_officer_id, inspection_id])
                
                # Добавляем других участников
                for participant_id in participants:
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