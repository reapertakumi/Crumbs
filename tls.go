package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// HTTPS next to HTTP. Crumbs serves both at once (9099 and 9443 by default),
// so everyone can pick. Your own certificate: set TLS_CERT and TLS_KEY.
// Otherwise Crumbs makes a self-signed one in data/tls the first time
// (browsers show a warning once; accept it for your Pi). TLS_HOSTS adds the
// names/IPs you open Crumbs with, e.g. "raspberrypi.local,192.168.1.50".

func (a *App) tlsConfig() (*tls.Config, error) {
	certFile, keyFile := os.Getenv("TLS_CERT"), os.Getenv("TLS_KEY")
	if certFile == "" || keyFile == "" {
		dir := filepath.Join(a.dataDir, "tls")
		certFile, keyFile = filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem")
		if _, err := os.Stat(certFile); errors.Is(err, os.ErrNotExist) {
			if err := os.MkdirAll(dir, 0o700); err != nil {
				return nil, err
			}
			if err := selfSigned(certFile, keyFile); err != nil {
				return nil, err
			}
			log.Printf("made a self-signed HTTPS certificate in %s (delete the folder to make a new one)", dir)
		}
	}
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, err
	}
	return &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}, nil
}

func selfSigned(certFile, keyFile string) error {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	serial, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 120))
	tpl := x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: "Crumbs", Organization: []string{"Crumbs"}},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
	}
	if h, err := os.Hostname(); err == nil && h != "" {
		tpl.DNSNames = append(tpl.DNSNames, h)
	}
	for _, h := range strings.Split(os.Getenv("TLS_HOSTS"), ",") {
		if h = strings.TrimSpace(h); h == "" {
			continue
		}
		if ip := net.ParseIP(h); ip != nil {
			tpl.IPAddresses = append(tpl.IPAddresses, ip)
		} else {
			tpl.DNSNames = append(tpl.DNSNames, h)
		}
	}
	der, err := x509.CreateCertificate(rand.Reader, &tpl, &tpl, &key.PublicKey, key)
	if err != nil {
		return err
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return err
	}
	if err := os.WriteFile(certFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o644); err != nil {
		return err
	}
	return os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0o600)
}

// redirectToHTTPS sends plain-HTTP visitors to the HTTPS port (HTTP_REDIRECT=1).
func redirectToHTTPS(port string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if h, _, err := net.SplitHostPort(host); err == nil {
			host = h
		}
		target := "https://" + net.JoinHostPort(host, port) + r.URL.RequestURI()
		http.Redirect(w, r, target, http.StatusMovedPermanently)
	})
}
