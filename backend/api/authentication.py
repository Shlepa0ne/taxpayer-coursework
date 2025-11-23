from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser

class InnAuthentication(BaseAuthentication):
    """
    Аутентификация по кастомному JWT, где есть только inn и user_type.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        token_str = auth_header.split(' ')[1]

        try:
            token = AccessToken(token_str)
        except Exception:
            return None

        inn = token.get('inn')
        user_type = token.get('user_type')

        if not inn or not user_type:
            return None

        # Создаем "виртуального" пользователя
        user = AnonymousUser()
        user.username = inn
        user.inn = inn
        user.user_type = user_type

        return (user, None)
