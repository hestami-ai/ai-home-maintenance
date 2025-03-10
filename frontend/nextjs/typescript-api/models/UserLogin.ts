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

import { mapValues } from '../runtime';
/**
 * 
 * @export
 * @interface UserLogin
 */
export interface UserLogin {
    /**
     * 
     * @type {string}
     * @memberof UserLogin
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof UserLogin
     */
    password: string;
}

/**
 * Check if a given object implements the UserLogin interface.
 */
export function instanceOfUserLogin(value: object): value is UserLogin {
    if (!('email' in value) || value['email'] === undefined) return false;
    if (!('password' in value) || value['password'] === undefined) return false;
    return true;
}

export function UserLoginFromJSON(json: any): UserLogin {
    return UserLoginFromJSONTyped(json, false);
}

export function UserLoginFromJSONTyped(json: any, ignoreDiscriminator: boolean): UserLogin {
    if (json == null) {
        return json;
    }
    return {
        
        'email': json['email'],
        'password': json['password'],
    };
}

export function UserLoginToJSON(json: any): UserLogin {
    return UserLoginToJSONTyped(json, false);
}

export function UserLoginToJSONTyped(value?: UserLogin | null, ignoreDiscriminator: boolean = false): any {
    if (value == null) {
        return value;
    }

    return {
        
        'email': value['email'],
        'password': value['password'],
    };
}

