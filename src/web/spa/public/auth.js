/**
 * auth.js — Cognito USER_PASSWORD_AUTH bootstrap for Orange Whip Surf
 *
 * Reads window.COGNITO_USER_POOL_ID and window.COGNITO_CLIENT_ID (set by config.js).
 * Exposes window.auth with callback-style helpers consumed by the SPA.
 *
 * Token storage: localStorage with key prefix "ows_".
 * Auto-refresh: on getAccessToken() if the current token is expired.
 */
(function () {
  'use strict';

  /* ---------- configuration ---------- */

  const POOL_ID   = () => window.COGNITO_USER_POOL_ID;
  const CLIENT_ID = () => window.COGNITO_CLIENT_ID;
  const REGION    = () => (POOL_ID() || '').split('_')[0];   // e.g. "us-west-2"
  const ENDPOINT  = () => `https://cognito-idp.${REGION()}.amazonaws.com/`;

  const LS_PREFIX        = 'ows_';
  const KEY_ACCESS       = LS_PREFIX + 'access_token';
  const KEY_ID           = LS_PREFIX + 'id_token';
  const KEY_REFRESH      = LS_PREFIX + 'refresh_token';
  const KEY_EXPIRES      = LS_PREFIX + 'token_expires';
  const KEY_USER_SUB     = LS_PREFIX + 'user_sub';

  /* ---------- helpers ---------- */

  function cognitoFetch(action, payload, cb) {
    fetch(ENDPOINT(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.' + action,
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var err = new Error(data.message || data.__type || 'Cognito error');
            err.code = data.__type;
            return cb(err);
          }
          cb(null, data);
        });
      })
      .catch(function (err) {
        cb(err);
      });
  }

  function storeTokens(result) {
    var auth = result.AuthenticationResult;
    if (!auth) return;
    localStorage.setItem(KEY_ACCESS, auth.AccessToken);
    localStorage.setItem(KEY_ID, auth.IdToken);
    if (auth.RefreshToken) {
      localStorage.setItem(KEY_REFRESH, auth.RefreshToken);
    }
    // ExpiresIn is seconds from now
    var expiresAt = Date.now() + auth.ExpiresIn * 1000;
    localStorage.setItem(KEY_EXPIRES, String(expiresAt));
  }

  function clearTokens() {
    [KEY_ACCESS, KEY_ID, KEY_REFRESH, KEY_EXPIRES, KEY_USER_SUB].forEach(function (k) {
      localStorage.removeItem(k);
    });
  }

  function isTokenExpired() {
    var exp = localStorage.getItem(KEY_EXPIRES);
    if (!exp) return true;
    // Consider expired 60s early to allow for latency
    return Date.now() > Number(exp) - 60000;
  }

  /* ---------- token refresh ---------- */

  function refreshTokens(cb) {
    var refreshToken = localStorage.getItem(KEY_REFRESH);
    if (!refreshToken) {
      return cb(new Error('No refresh token available'));
    }

    cognitoFetch('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID(),
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    }, function (err, data) {
      if (err) {
        clearTokens();
        return cb(err);
      }
      storeTokens(data);
      cb(null);
    });
  }

  /* ---------- public API ---------- */

  /**
   * Sign in with email and password.
   * cb(err, { accessToken, idToken, refreshToken })
   */
  function signIn(email, password, cb) {
    cognitoFetch('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID(),
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }, function (err, data) {
      if (err) return cb(err);

      // Handle challenges (NEW_PASSWORD_REQUIRED, etc.)
      if (data.ChallengeName) {
        return cb(null, {
          challenge: data.ChallengeName,
          session: data.Session,
          challengeParameters: data.ChallengeParameters,
        });
      }

      storeTokens(data);
      cb(null, {
        accessToken: data.AuthenticationResult.AccessToken,
        idToken: data.AuthenticationResult.IdToken,
        refreshToken: data.AuthenticationResult.RefreshToken,
      });
    });
  }

  /**
   * Sign up with email and password.
   * cb(err, { userSub, userConfirmed })
   */
  function signUp(email, password, cb) {
    cognitoFetch('SignUp', {
      ClientId: CLIENT_ID(),
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
      ],
    }, function (err, data) {
      if (err) return cb(err);
      if (data.UserSub) {
        localStorage.setItem(KEY_USER_SUB, data.UserSub);
      }
      cb(null, {
        userSub: data.UserSub,
        userConfirmed: data.UserConfirmed,
      });
    });
  }

  /**
   * Confirm sign-up with verification code.
   * cb(err)
   */
  function confirmSignUp(email, code, cb) {
    cognitoFetch('ConfirmSignUp', {
      ClientId: CLIENT_ID(),
      Username: email,
      ConfirmationCode: code,
    }, function (err) {
      cb(err || null);
    });
  }

  /**
   * Respond to an auth challenge (e.g. NEW_PASSWORD_REQUIRED).
   * cb(err, result)
   */
  function respondToChallenge(challengeName, session, responses, cb) {
    cognitoFetch('RespondToAuthChallenge', {
      ClientId: CLIENT_ID(),
      ChallengeName: challengeName,
      Session: session,
      ChallengeResponses: responses,
    }, function (err, data) {
      if (err) return cb(err);
      if (data.AuthenticationResult) {
        storeTokens(data);
      }
      cb(null, data);
    });
  }

  /**
   * Sign out (clear local tokens).
   * Optionally calls GlobalSignOut to revoke server-side.
   */
  function signOut() {
    var accessToken = localStorage.getItem(KEY_ACCESS);
    clearTokens();

    // Best-effort server-side sign-out
    if (accessToken) {
      cognitoFetch('GlobalSignOut', {
        AccessToken: accessToken,
      }, function () { /* ignore errors */ });
    }
  }

  /**
   * Check whether the user has valid (or refreshable) tokens.
   * cb(err, isAuthenticated: boolean)
   */
  function isAuthenticated(cb) {
    var token = localStorage.getItem(KEY_ACCESS);
    if (!token) return cb(null, false);

    if (isTokenExpired()) {
      refreshTokens(function (err) {
        if (err) return cb(null, false);
        cb(null, true);
      });
    } else {
      cb(null, true);
    }
  }

  /**
   * Get a valid access token, refreshing if necessary.
   * cb(err, token)
   */
  function getAccessToken(cb) {
    if (isTokenExpired()) {
      refreshTokens(function (err) {
        if (err) return cb(err);
        cb(null, localStorage.getItem(KEY_ACCESS));
      });
    } else {
      cb(null, localStorage.getItem(KEY_ACCESS));
    }
  }

  /**
   * Get a valid ID token, refreshing if necessary.
   * cb(err, token)
   */
  function getIdToken(cb) {
    if (isTokenExpired()) {
      refreshTokens(function (err) {
        if (err) return cb(err);
        cb(null, localStorage.getItem(KEY_ID));
      });
    } else {
      cb(null, localStorage.getItem(KEY_ID));
    }
  }

  /**
   * Decode the payload of a JWT (no verification – client-side only).
   */
  function decodeToken(token) {
    try {
      var parts = token.split('.');
      var payload = parts[1];
      // Base64url → Base64
      payload = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the Cognito groups from the ID token.
   * Returns an array of group names or [].
   */
  function getGroups() {
    var idToken = localStorage.getItem(KEY_ID);
    if (!idToken) return [];
    var payload = decodeToken(idToken);
    return (payload && payload['cognito:groups']) || [];
  }

  /**
   * Get user info from the ID token.
   */
  function getUserInfo() {
    var idToken = localStorage.getItem(KEY_ID);
    if (!idToken) return null;
    var payload = decodeToken(idToken);
    if (!payload) return null;
    return {
      sub: payload.sub,
      email: payload.email,
      groups: payload['cognito:groups'] || [],
      emailVerified: payload.email_verified,
    };
  }

  /* ---------- expose ---------- */

  window.auth = {
    signIn: signIn,
    signUp: signUp,
    confirmSignUp: confirmSignUp,
    respondToChallenge: respondToChallenge,
    signOut: signOut,
    isAuthenticated: isAuthenticated,
    getAccessToken: getAccessToken,
    getIdToken: getIdToken,
    decodeToken: decodeToken,
    getGroups: getGroups,
    getUserInfo: getUserInfo,
  };
})();
