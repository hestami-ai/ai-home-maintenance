/* tslint:disable */
/* eslint-disable */
/**
 * Hestami AI API
 * API documentation for Hestami AI
 *
 * The version of the OpenAPI document: 1.0.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


import * as runtime from '../runtime';

export interface ServicesRequestsCompleteCreateRequest {
    requestId: number;
}

export interface ServicesRequestsRetrieve2Request {
    requestId: number;
}

export interface ServicesRequestsReviewCreateRequest {
    requestId: number;
}

export interface ServicesRequestsStartCreateRequest {
    requestId: number;
}

export interface ServicesRequestsUpdateRequest {
    requestId: number;
}

/**
 * 
 */
export class ServicesApi extends runtime.BaseAPI {

    /**
     * List all active service categories
     */
    async servicesCategoriesRetrieveRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/categories/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * List all active service categories
     */
    async servicesCategoriesRetrieve(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesCategoriesRetrieveRaw(initOverrides);
    }

    /**
     * Get or update service provider profile
     */
    async servicesProvidersProfileRetrieveRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/providers/profile/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Get or update service provider profile
     */
    async servicesProvidersProfileRetrieve(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesProvidersProfileRetrieveRaw(initOverrides);
    }

    /**
     * Get or update service provider profile
     */
    async servicesProvidersProfileUpdateRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/providers/profile/`,
            method: 'PUT',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Get or update service provider profile
     */
    async servicesProvidersProfileUpdate(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesProvidersProfileUpdateRaw(initOverrides);
    }

    /**
     * List service providers filtered by category and location
     */
    async servicesProvidersRetrieveRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/providers/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * List service providers filtered by category and location
     */
    async servicesProvidersRetrieve(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesProvidersRetrieveRaw(initOverrides);
    }

    /**
     * Complete a service and create service report
     */
    async servicesRequestsCompleteCreateRaw(requestParameters: ServicesRequestsCompleteCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['requestId'] == null) {
            throw new runtime.RequiredError(
                'requestId',
                'Required parameter "requestId" was null or undefined when calling servicesRequestsCompleteCreate().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/requests/{request_id}/complete/`.replace(`{${"request_id"}}`, encodeURIComponent(String(requestParameters['requestId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Complete a service and create service report
     */
    async servicesRequestsCompleteCreate(requestParameters: ServicesRequestsCompleteCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesRequestsCompleteCreateRaw(requestParameters, initOverrides);
    }

    /**
     * Create a new service request
     */
    async servicesRequestsCreateCreateRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/requests/create/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Create a new service request
     */
    async servicesRequestsCreateCreate(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesRequestsCreateCreateRaw(initOverrides);
    }

    /**
     * List service requests based on user role
     */
    async servicesRequestsRetrieveRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/requests/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * List service requests based on user role
     */
    async servicesRequestsRetrieve(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesRequestsRetrieveRaw(initOverrides);
    }

    /**
     * Get or update service request details
     */
    async servicesRequestsRetrieve2Raw(requestParameters: ServicesRequestsRetrieve2Request, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['requestId'] == null) {
            throw new runtime.RequiredError(
                'requestId',
                'Required parameter "requestId" was null or undefined when calling servicesRequestsRetrieve2().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/requests/{request_id}/`.replace(`{${"request_id"}}`, encodeURIComponent(String(requestParameters['requestId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Get or update service request details
     */
    async servicesRequestsRetrieve2(requestParameters: ServicesRequestsRetrieve2Request, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesRequestsRetrieve2Raw(requestParameters, initOverrides);
    }

    /**
     * Create a review for a completed service
     */
    async servicesRequestsReviewCreateRaw(requestParameters: ServicesRequestsReviewCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['requestId'] == null) {
            throw new runtime.RequiredError(
                'requestId',
                'Required parameter "requestId" was null or undefined when calling servicesRequestsReviewCreate().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/requests/{request_id}/review/`.replace(`{${"request_id"}}`, encodeURIComponent(String(requestParameters['requestId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Create a review for a completed service
     */
    async servicesRequestsReviewCreate(requestParameters: ServicesRequestsReviewCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesRequestsReviewCreateRaw(requestParameters, initOverrides);
    }

    /**
     * Start a scheduled service
     */
    async servicesRequestsStartCreateRaw(requestParameters: ServicesRequestsStartCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['requestId'] == null) {
            throw new runtime.RequiredError(
                'requestId',
                'Required parameter "requestId" was null or undefined when calling servicesRequestsStartCreate().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/requests/{request_id}/start/`.replace(`{${"request_id"}}`, encodeURIComponent(String(requestParameters['requestId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Start a scheduled service
     */
    async servicesRequestsStartCreate(requestParameters: ServicesRequestsStartCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesRequestsStartCreateRaw(requestParameters, initOverrides);
    }

    /**
     * Get or update service request details
     */
    async servicesRequestsUpdateRaw(requestParameters: ServicesRequestsUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['requestId'] == null) {
            throw new runtime.RequiredError(
                'requestId',
                'Required parameter "requestId" was null or undefined when calling servicesRequestsUpdate().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("jwtAuth", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/services/requests/{request_id}/`.replace(`{${"request_id"}}`, encodeURIComponent(String(requestParameters['requestId']))),
            method: 'PUT',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Get or update service request details
     */
    async servicesRequestsUpdate(requestParameters: ServicesRequestsUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.servicesRequestsUpdateRaw(requestParameters, initOverrides);
    }

}
