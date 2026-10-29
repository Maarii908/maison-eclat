<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class HomeController extends AbstractController
{
    #[Route('/', name: 'app_home')]
    public function index(HttpClientInterface $httpClient): Response
    {
        $produits = [];

        try {
            $response = $httpClient->request(
                'GET',
                'http://host.docker.internal:1337/api/produits?populate=*'
            );

            $data = $response->toArray();

            $produits = $data['data'] ?? [];
        } catch (\Throwable $e) {
            // La page reste accessible si Strapi est indisponible.
        }

        return $this->render('home/index.html.twig', [
            'produits' => $produits,
        ]);
    }
}
