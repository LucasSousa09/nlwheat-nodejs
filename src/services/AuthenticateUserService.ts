import axios from "axios";
import prismaClient from "../prisma";
import { sign } from "jsonwebtoken";


/**
 *  Receber code(string)
 *  Recuperar o access_token no github
 * Verificar se o usuário existe no banco de dados
 * Caso afirmativo: gera um token
 * Caso negativo: Gera no Banco de Dados, gera um token
 * Retorna um token com as informações do usuário logado
 */

interface IAccessTokenResponse {
    access_token: string
}

interface IUserResponse {
    avatar_url: string,
    login: string,
    id: number,
    name: string,
}

class AuthenticateUserService {
    async execute(code: string) {
        const url = "https://github.com/login/oauth/access_token";

        const { data: accessTokenResponse } = await axios.post<IAccessTokenResponse>(url, null, {
            params: {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            },
            headers: {
                "Accept": "application/json"
            }
        })

        const response = await axios.get<IUserResponse>('https://api.github.com/user', {
            headers: {
                authorization: `Bearer ${accessTokenResponse.access_token}`
            }
        })

        const { login, id, avatar_url, name } = response.data

        // Pesquisa no banco de dados se o usuário existe
        let user = await prismaClient.user.findFirst({
            where: {
                github_id: id
            }
        })
        // Se o usuário não existe cria um novo usuário
        if (!user) {
            user = await prismaClient.user.create({
                data: {
                    github_id: id,
                    login,
                    avatar_url,
                    name
                }
            })
        }

        const token = sign(
            {
                user: {
                    name: user.name,
                    avatar_url: user.avatar_url,
                    id: user.id
                }
            },
            process.env.JWT_SECRET,
            {
                subject: user.id,
                expiresIn: "1d"
            }
        )


        return { token, user };
    }
}

export { AuthenticateUserService }