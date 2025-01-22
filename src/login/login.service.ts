import { HttpException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import BeFake from 'src/BeFake/BeFake';
import getHeaders from 'src/BeFake/headers';
import { BeFakeResponse } from 'src/BeFake/types/BeFakeResponse';
import { APIresponse, tokenObj } from 'src/types/types';

@Injectable()
export class LoginService {
    private readonly logger = new Logger(LoginService.name);
    private readonly DEFAULT_DEVICE_ID = '8xe8mhr43xc2q241'; // Use the same deviceId that works in the frontend

    constructor(private jwtService: JwtService) {} // Constructor with jwtService

    // Get tokens object and return token
    public async tokenize(tokenObj: tokenObj): Promise<string> {
        return await this.jwtService.signAsync(tokenObj);
    }

    // Get tokens object and return token
    public async tokenizeAll(tokenObj: any): Promise<string> {
        return await this.jwtService.signAsync(tokenObj);
    }

    // Get token and return token object
    public async getToken(token: string): Promise<APIresponse> {
        try {
            return {
                status: 200,
                message: 'Token generated',
                data: await this.jwtService.verifyAsync(token),
            };
        } catch (error) {
            throw new HttpException(
                {
                    status: 400,
                    message: 'Token not generated',
                    data: error,
                },
                400,
            );
        }
    }

    public async getTokenInfo(token: string): Promise<APIresponse> {
        try {
            const { status, data }: APIresponse = await this.getToken(token);
            if (status != 200) {
                throw new HttpException(
                    {
                        status: 400,
                        message: 'Token not generated',
                        data: data,
                    },
                    400,
                );
            }
            return {
                status: 200,
                message: 'Token generated',
                data: { data: data, headers: getHeaders() },
            };
        } catch (error) {
            throw new HttpException(
                {
                    status: 400,
                    message: 'Token not generated',
                    data: error,
                },
                400,
            );
        }
    }

    public async sendCode(body: {
        phone: string;
        deviceId?: string;
    }): Promise<APIresponse> {
        this.logger.debug('Attempting to send code to:', body.phone);

        try {
            const bf = new BeFake(
                null,
                body.deviceId || this.DEFAULT_DEVICE_ID,
            );

            // Try Vonage first
            const vonageResponse: BeFakeResponse = await bf.sendOtpVonage(
                body.phone,
            );
            this.logger.debug('Vonage response:', vonageResponse);

            if (vonageResponse.done && vonageResponse.data?.sessionInfo) {
                return {
                    status: 201,
                    message: 'OTP sent successfully via Vonage',
                    data: {
                        otpSession: vonageResponse.data.sessionInfo,
                        deviceId: bf.deviceId,
                    },
                };
            }

            // If Vonage fails, try Cloud
            const cloudResponse: BeFakeResponse = await bf.sendOtpCloud(
                body.phone,
            );
            this.logger.debug('Cloud response:', cloudResponse);

            if (cloudResponse.done && cloudResponse.data?.sessionInfo) {
                return {
                    status: 201,
                    message: 'OTP sent successfully via Cloud',
                    data: {
                        otpSession: cloudResponse.data.sessionInfo,
                        deviceId: bf.deviceId,
                    },
                };
            }

            // If both methods fail, throw an error with details
            throw new HttpException(
                {
                    status: 400,
                    message: 'OTP not sent',
                    data: {
                        vonageError: vonageResponse.data,
                        cloudError: cloudResponse.data,
                    },
                    details: 'Both verification methods failed',
                },
                400,
            );
        } catch (error) {
            this.logger.error('Error sending code:', error);
            throw new HttpException(
                {
                    status: 400,
                    message: 'OTP not sent',
                    data: error.response?.data || error,
                    details: error.message,
                },
                400,
            );
        }
    }

    public async sendVonageCode(body: {
        phone: string;
        deviceId?: string;
    }): Promise<APIresponse> {
        this.logger.log('Received request body:', body);

        if (!body?.phone) {
            this.logger.error('Phone number is missing from request');
            throw new HttpException(
                {
                    status: 400,
                    message: 'Phone number is required',
                    data: null,
                },
                400,
            );
        }

        try {
            // Initialize BeFake with deviceId
            const deviceId = body.deviceId || this.DEFAULT_DEVICE_ID;
            const bf = new BeFake({
                access: {
                    refresh_token: '',
                    token: '',
                    expires: '',
                },
                firebase: {
                    refresh_token: '',
                    token: '',
                    expires: '',
                },
                userId: '',
                deviceId,
            });

            this.logger.debug(
                'Initialized BeFake instance with deviceId:',
                deviceId,
            );

            // Format the request data as expected by BeReal API
            const formattedPhone = body.phone.startsWith('+')
                ? body.phone
                : `+${body.phone}`;

            this.logger.debug('Sending request with:', {
                phoneNumber: formattedPhone,
                deviceId: deviceId,
            });

            const response: BeFakeResponse = await bf.sendOtpVonage(
                formattedPhone,
            );
            this.logger.debug('Raw Vonage API Response:', response);

            if (response.done) {
                this.logger.log(`Successfully sent OTP to ${formattedPhone}`);
                return {
                    status: 201,
                    message: 'OTP sent',
                    data: {
                        ...response.data,
                        deviceId,
                    },
                };
            }

            this.logger.warn('BeReal API rejected the request:', {
                done: response.done,
                msg: response.msg,
                data: response.data,
            });

            throw new HttpException(
                {
                    status: 400,
                    message: response.msg || 'OTP not sent',
                    data: response.data,
                    details: 'BeReal API rejected the request',
                },
                400,
            );
        } catch (error) {
            if (error.isAxiosError) {
                this.logger.error('BeReal API request failed:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    requestData: error.config?.data,
                    headers: error.config?.headers,
                    url: error.config?.url,
                });
            }

            throw new HttpException(
                {
                    status: 400,
                    message: 'OTP not sent',
                    data: error.response?.data || error.message,
                    details:
                        error.response?.data ||
                        'Failed to communicate with BeReal API',
                },
                400,
            );
        }
    }

    public async verifyVonageCode(body: {
        code: string;
        otpSession: string;
    }): Promise<APIresponse> {
        this.logger.log('Attempting to verify Vonage code', {
            otpSession: body.otpSession?.substring(0, 10) + '...', // Log partial session for security
        });

        try {
            const bf = new BeFake();
            this.logger.debug('Initialized BeFake instance');

            const response: BeFakeResponse = await bf.verifyOtpVonage(
                body.code,
                body.otpSession,
            );
            this.logger.debug('Verify Response:', {
                done: response.done,
                hasData: !!response.data,
                message: response.msg,
            });

            if (response.done) {
                const tokenObj: tokenObj = bf.saveToken();
                this.logger.log(
                    'Successfully verified OTP and generated token',
                );

                return {
                    status: 201,
                    message: 'OTP verified',
                    data: {
                        token: await this.tokenize(tokenObj),
                    },
                };
            }

            this.logger.warn('Failed to verify OTP:', response.data);
            throw new HttpException(
                {
                    status: 400,
                    message: 'OTP not verified',
                    data: response.data,
                },
                400,
            );
        } catch (error) {
            this.logger.error('Error verifying Vonage code:', {
                error: error.message,
                stack: error.stack,
                data: error.data,
            });

            throw new HttpException(
                {
                    status: 500,
                    message: 'Internal server error',
                    data: error,
                },
                500,
            );
        }
    }

    public async verifyCode(body: {
        code: string;
        otpSession: string;
    }): Promise<APIresponse> {
        try {
            const bf = new BeFake();
            const response: BeFakeResponse = await bf.verifyOtpCloud(
                body.code,
                body.otpSession,
            );

            if (response.done) {
                const tokenObj: tokenObj = bf.saveToken();
                return {
                    status: 201,
                    message: 'OTP verified',
                    data: {
                        token: await this.tokenize(tokenObj),
                    },
                };
            }
            throw new HttpException(
                {
                    status: 400,
                    message: 'OTP not verified',
                    data: response.data,
                },
                400,
            );
        } catch (error) {
            throw new HttpException(
                {
                    status: 500,
                    message: 'Internal server error',
                    data: error,
                },
                500,
            );
        }
    }

    public async refreshToken(token: string): Promise<any> {
        try {
            const { status, data }: APIresponse = await this.getToken(token);
            if (status != 200) {
                throw new HttpException(
                    {
                        status: 400,
                        message: 'Token not generated',
                        data: data,
                    },
                    400,
                );
            }
            const oldTokenObj: tokenObj = data;
            const bf = new BeFake(oldTokenObj);
            await bf.firebaseRefreshTokens();
            const refreshTokensResponse: BeFakeResponse =
                await bf.refreshTokens();
            if (!refreshTokensResponse.done) {
                throw new HttpException(
                    {
                        status: 400,
                        message: 'Token not refreshed',
                        data: refreshTokensResponse.data,
                    },
                    400,
                );
            }
            const tokenObj: tokenObj = bf.saveToken();
            return {
                status: 201,
                message: 'Token refreshed',
                data: {
                    token: await this.tokenize(tokenObj),
                },
            };
        } catch (error) {
            throw new HttpException(
                {
                    status: 500,
                    message: 'Internal server error',
                    data: error,
                },
                500,
            );
        }
    }
}
